define([
  'core/js/adapt',
  './scormSuspendDataSerializer'
], function (Adapt) {

  //Captures the completion status and user selections of the question components
  //Returns and parses a base64 style string
  var includes = {
    '_isQuestionType': true
  };

  var serializer = {
    serialize: function () {
      return this.serializeSaveState();
    },

    serializeSaveState: function() {
      if (Adapt.course.get('_latestTrackingId') === undefined) {
        var message = "This course is missing a latestTrackingID.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
        console.error(message);
        return "";
      }

      var rtn = "";
      try {
        var data = this.captureData();
        if (data.length === 0) return "";
        rtn = SCORMSuspendData.serialize(data);
      } catch(e) {
        console.error(e);
      }

      return rtn;
    },

    captureData: function() {
      var data = [];

      var trackingIds = Adapt.blocks.pluck('_trackingId').filter(id => (Number.isInteger(id) && id >= 0));
      var blocks = {};
      var countInBlock = {};
      var config = Adapt.config.get('_spoor');
      var shouldStoreAttempts = config && config._tracking && config._tracking._shouldStoreAttempts;

      for (var i = 0, l = trackingIds.length; i < l; i++) {

        var trackingId = trackingIds[i];
        var blockModel = Adapt.blocks.findWhere({_trackingId: trackingId });
        var componentModels = blockModel.getChildren().where(includes);

        for (var c = 0, cl = componentModels.length; c < cl; c++) {

          var component = componentModels[c].toJSON();
          var blockId = component._parentId;

          if (!blocks[blockId]) {
            blocks[blockId] = blockModel.toJSON();
          }

          var block = blocks[blockId];
          if (countInBlock[blockId] === undefined) countInBlock[blockId] = -1;
          countInBlock[blockId]++;

          var blockLocation = countInBlock[blockId];

          var hasUserAnswer = (component._userAnswer !== undefined);
          var isUserAnswerArray = Array.isArray(component._userAnswer);

          if (hasUserAnswer && isUserAnswerArray && component._userAnswer.length === 0) {
            hasUserAnswer = false;
            isUserAnswerArray = false;
          }

          var hasAttemptStates = (component._attemptStates !== undefined);
          var isAttemptStatesArray = Array.isArray(component._attemptStates);
          if (hasAttemptStates && isAttemptStatesArray && component._attemptStates.length === 0) {
            hasAttemptStates = false;
            isAttemptStatesArray = false;
          }

          var numericParameters = [
            blockLocation,
            block._trackingId,
            component._score || 0,
            component._attemptsLeft || 0
          ];

          var booleanParameters = [
            hasUserAnswer,
            isUserAnswerArray,
            hasAttemptStates,
            isAttemptStatesArray,
            component._isComplete,
            component._isInteractionComplete,
            component._isSubmitted,
            component._isCorrect || false
          ];

          var dataItem = [
            numericParameters,
            booleanParameters
          ];

          var invalidError;
          if (hasUserAnswer) {
            var userAnswer = isUserAnswerArray ? component._userAnswer : [component._userAnswer];

            invalidError = SCORMSuspendData.getInvalidTypeError(userAnswer);

            if (invalidError) {
              console.log("Cannot store _userAnswers from component " + component._id + " as array is invalid", invalidError);
              continue;
            }

            dataItem.push(userAnswer);
          } else {
            dataItem.push([]);
          }

          if (shouldStoreAttempts && hasAttemptStates) {
            var attemptStates = isAttemptStatesArray ? component._attemptStates : [component_attemptStates];

            invalidError = SCORMSuspendData.getInvalidTypeError(userAnswer);

            if (invalidError) {
              console.log(`Cannot store _attemptStates from component ${component._id} as array is invalid`, invalidError);
              continue;
            }

            dataItem.push(attemptStates);
          } else {
            dataItem.push([]);
          }

          data.push(dataItem);

        }

      }

      return data;

    },

    deserialize: function (str) {

      try {
        var data = SCORMSuspendData.deserialize(str);
        this.releaseData( data );
      } catch(e) {
        console.error(e);
      }

    },

    releaseData: function (arr) {

      var config = Adapt.config.get('_spoor');
      var shouldStoreAttempts = config && config._tracking && config._tracking._shouldStoreAttempts;

      for (var i = 0, l = arr.length; i < l; i++) {
        var dataItem = arr[i];

        var numericParameters = dataItem[0];
        var booleanParameters = dataItem[1];

        var blockLocation = numericParameters[0];
        var trackingId = numericParameters[1];
        var _score = numericParameters[2];
        var _attemptsLeft = numericParameters[3] || 0;

        var hasUserAnswer = booleanParameters[0];
        var isUserAnswerArray = booleanParameters[1];
        var hasAttemptStates = booleanParameters[2];
        var isAttemptStatesArray = booleanParameters[3];
        var _isComplete = booleanParameters[4];
        var _isInteractionComplete = booleanParameters[5];
        var _isSubmitted = booleanParameters[6];
        var _isCorrect = booleanParameters[7];

        var block = Adapt.blocks.findWhere({_trackingId: trackingId});
        var components = block.getChildren();
        components = components.where(includes);
        var component = components[blockLocation];

        component.set({
          _isComplete,
          _isInteractionComplete,
          _isSubmitted,
          _score,
          _isCorrect,
          _attemptsLeft
        });

        if (hasUserAnswer) {
          var userAnswer = dataItem[2];
          if (!isUserAnswerArray) userAnswer = userAnswer[0];

          component.set("_userAnswer", userAnswer);
        }

        if (shouldStoreAttempts && hasAttemptStates) {
          var attemptStates = dataItem[3];
          if (!isAttemptStatesArray) attemptStates = attemptStates[0];

          component.set('_attemptStates', attemptStates);
        }

      }
    }
  };

  return serializer;

});
