define([
  'core/js/adapt',
  './SCORMSuspendData'
], function (Adapt, SCORMSuspendData) {

  class ComponentSerializer extends Backbone.Controller {

    initialize(trackingIdType) {
      this.trackingIdType = trackingIdType;
    }

    serialize() {
      const states = [];
      Adapt.data.each(model => {
        if (model.get('_type') !== this.trackingIdType) {
          return;
        }
        const trackingId = model.get('_trackingId');
        if (typeof trackingId === 'undefined') {
          return;
        }
        const isContainer = model.hasManagedChildren;
        const components = isContainer ?
          model.findDescendantModels('component') :
          [model];
        components.forEach((component, index) => {
          let modelState = null;
          if (!component.getAttemptState) {
            // Legacy components without getAttemptState
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
          // correct the useranswer array as it is sometimes not an array
          // incomplete components are undefined and slider is a number
          const userAnswer = modelState[2][0];
          const hasUserAnswer = typeof userAnswer !== 'undefined' && userAnswer !== null;
          const isUserAnswerArray = Array.isArray(userAnswer);
          if (!hasUserAnswer) {
            modelState[2][0] = [];
          } else if (!isUserAnswerArray) {
            modelState[2][0] = [modelState[2][0]];
          }
          // attemptstates is empty if not a question or not attempted
          const attemptStates = modelState[2][0];
          const hasAttemptStates = !Array.isArray(attemptStates);
          if (!hasAttemptStates) {
            modelState[2][1] = [];
          }
          // create the restoration state object
          const state = [
            [ trackingId, index ],
            [ hasUserAnswer, isUserAnswerArray, hasAttemptStates ],
            modelState
          ];
          states.push(state);
        });
      });
      return SCORMSuspendData.serialize(states);
    }

    deserialize(binary) {
      const trackingIdMap = Adapt.data.toArray().reduce((trackingIdMap, model) => {
        const trackingId = model.get('_trackingId');
        if (typeof trackingId === 'undefined') return trackingIdMap;
        trackingIdMap[trackingId] = model;
        return trackingIdMap;
      }, {});
      const states = SCORMSuspendData.deserialize(binary);
      states.forEach(state => {
        const [ trackingId, index ] = state[0];
        const [ hasUserAnswer, isUserAnswerArray, hasAttemptStates ] = state[1];
        const modelState = state[2];
        // correct useranswer
        if (!hasUserAnswer) {
          modelState[2][0] = null;
        } else if (!isUserAnswerArray) {
          modelState[2][0] = modelState[2][0][0];
        }
        // allow empty attemptstates
        if (!hasAttemptStates) {
          modelState[2][1] = null;
        }
        const model = trackingIdMap[trackingId];
        const isContainer = model.hasManagedChildren;
        const components = isContainer ?
          model.findDescendantModels('component') :
          [model];
        const component = components[index];
        if (component.setAttemptObject) {
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
            _userAnswer: modelState[2][0]
          }) :
          component.set({
            _isComplete: modelState[1][0],
            _isInteractionComplete: modelState[1][1],
            _userAnswer: modelState[2][0]
          });
      });
    }

  }

  return ComponentSerializer;

});
