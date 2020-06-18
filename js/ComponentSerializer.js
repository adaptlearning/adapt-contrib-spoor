define([
  'core/js/adapt',
  'libraries/SCORMSuspendData'
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
          let modelState = null
          if (!component.getAttemptState) {
            // Legacy components without getAttemptState
            modelState = [
              [],
              [component.get('_isComplete'), component.get('_isInteractionComplete')],
              [component.get('_userAnswer')]
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
        if (!component.setAttemptObject) {
          // Legacy components without getAttemptState
          component.set({
            _isComplete: modelState[1][0],
            _isInteractionComplete: modelState[1][0],
            _userAnswer: modelState[2][0]
          });
        } else {
          const attemptObject = component.getAttemptObject(modelState);
          component.setAttemptObject(attemptObject, false);
        }
      });
    }

  }

  return ComponentSerializer;

});
