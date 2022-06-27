import logging from 'core/js/logging';
import data from 'core/js/data';
import SCORMSuspendData from './SCORMSuspendData';

export default class ComponentSerializer extends Backbone.Controller {

  initialize(trackingIdType, shouldCompress) {
    this.trackingIdType = trackingIdType;
    this.shouldCompress = shouldCompress;
  }

  async serialize(shouldStoreResponses, shouldStoreAttempts) {
    if (shouldStoreAttempts && !shouldStoreResponses) {
      logging.warnOnce('SPOOR configuration error, cannot use \'_shouldStoreAttempts\' without \'_shouldStoreResponses\'');
    }
    const states = [];
    data.each(model => {
      if (model.get('_type') !== this.trackingIdType) {
        return;
      }
      const trackingId = model.get('_trackingId');
      if (typeof trackingId === 'undefined') {
        return;
      }
      const isContainer = model.hasManagedChildren;
      let components = isContainer ?
        model.findDescendantModels('component') :
        [model];
      components = components.filter(component => component.get('_isTrackable') !== false);
      components.forEach((component, index) => {
        if (component.get('_isTrackable') === false) {
          return;
        }
        if (!shouldStoreResponses) {
          // Store only component completion
          const state = [
            [ trackingId, index ],
            [ component.get('_isComplete') ]
          ];
          states.push(state);
          return;
        }
        let modelState = null;
        if (!component.getAttemptState) {
          // Legacy components without getAttemptState API
          modelState = component.get('_isQuestionType') ?
            [
              [
                component.get('_score') || 0,
                component.get('_attemptsLeft') || 0
              ],
              [
                component.get('_isComplete') || false,
                component.get('_isInteractionComplete') || false,
                component.get('_isSubmitted') || false,
                component.get('_isCorrect') || false
              ],
              [
                component.get('_userAnswer')
              ]
            ] :
            [
              [],
              [
                component.get('_isComplete') || false,
                component.get('_isInteractionComplete') || false
              ],
              [
                component.get('_userAnswer')
              ]
            ];
        } else {
          modelState = component.getAttemptState();
        }
        // Correct the _userAnswer array as it is sometimes not an array
        // incomplete components are undefined and slider is a number
        const userAnswer = modelState[2][0];
        const hasUserAnswer = typeof userAnswer !== 'undefined' && userAnswer !== null;
        const isUserAnswerArray = Array.isArray(userAnswer);
        if (!hasUserAnswer) {
          modelState[2][0] = [];
        } else if (!isUserAnswerArray) {
          modelState[2][0] = [modelState[2][0]];
        }
        // _attemptStates is empty if not a question or not attempted
        const attemptStates = component.get('_attemptStates');
        const hasAttemptStates = shouldStoreAttempts && Array.isArray(attemptStates);
        if (hasAttemptStates) {
          modelState[2][1] = attemptStates;
        }
        // Create the restoration state object
        const state = [
          [ trackingId, index ],
          [ hasUserAnswer, isUserAnswerArray, hasAttemptStates ],
          modelState
        ];
        states.push(state);
      });
    });
    if (this.shouldCompress) return await SCORMSuspendData.serializeAsync(states);
    return SCORMSuspendData.serialize(states);
  }

  deserialize(binary) {
    // Build a table of models and their tracking ids
    const trackingIdMap = data.toArray().reduce((trackingIdMap, model) => {
      const trackingId = model.get('_trackingId');
      if (typeof trackingId === 'undefined') return trackingIdMap;
      trackingIdMap[trackingId] = model;
      return trackingIdMap;
    }, {});
    const states = SCORMSuspendData.deserialize(binary);
    // Derive the storage settings of the data from the states array, this will allow changes
    // in the spoor configuration for _shouldStoreResponses and _shouldStoreAttempts
    // to be non-breaking
    const shouldStoreResponses = (states[0].length > 2);
    states.forEach(state => {
      const [ trackingId, index ] = state[0];
      const model = trackingIdMap[trackingId];
      if (!model) {
        // Ignore any recently missing tracking ids if a course has been updated
        return;
      }
      const isContainer = model.hasManagedChildren;
      let components = isContainer ?
        model.findDescendantModels('component') :
        [model];
      components = components.filter(component => component.get('_isTrackable') !== false);
      const component = components[index];
      if (!component) {
        logging.warn(`SPOOR could not restore tracking id: ${trackingId}, index: ${index}`);
        return;
      }
      if (!shouldStoreResponses) {
        // Restore only component completion
        const isComplete = state[1][0];
        component.set('_isComplete', isComplete);
        return;
      }
      const [ hasUserAnswer, isUserAnswerArray, hasAttemptStates ] = state[1];
      const modelState = state[2];
      // Correct the _userAnswer value if it wasn't an array originally
      if (!hasUserAnswer) {
        modelState[2][0] = null;
      } else if (!isUserAnswerArray) {
        modelState[2][0] = modelState[2][0][0];
      }
      // Allow empty _attemptStates
      if (!hasAttemptStates) {
        modelState[2][1] = null;
      }
      if (component.setAttemptObject) {
        // Restore component state with setAttemptObject API
        component.set('_attemptStates', modelState[2][1]);
        const attemptObject = component.getAttemptObject(modelState);
        component.setAttemptObject(attemptObject, false);
        return;
      }
      // Legacy components without getAttemptState
      component.get('_isQuestionType') ?
        component.set({
          _score: modelState[0][0],
          _attemptsLeft: modelState[0][1],
          _isComplete: modelState[1][0],
          _isInteractionComplete: modelState[1][1],
          _isSubmitted: modelState[1][2],
          _isCorrect: modelState[1][3],
          _userAnswer: modelState[2][0],
          _attemptStates: modelState[2][1]
        }) :
        component.set({
          _isComplete: modelState[1][0],
          _isInteractionComplete: modelState[1][1],
          _userAnswer: modelState[2][0],
          _attemptStates: modelState[2][1]
        });
    });
  }

}
