define(['coreJS/adapt'], function (Adapt) {
    return {

        serialise: function () {
            return {
                spoor: {
                    completion: this.serialiseSaveState('_isComplete'),
                    _isCourseComplete: Adapt.course.get('_isComplete') || false,
                    _isAssessmentPassed: Adapt.course.get('_isAssessmentPassed') || false
                }
          };
        },

        serialiseSaveState: function(attribute) {
            if (Adapt.course.get('_latestTrackingId') === undefined) {
                var message = "This course is missing a latestTrackingID.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                console.error(message);
            }
            var excludeAssessments = Adapt.config.get('_spoor') && Adapt.config.get('_spoor')._tracking && Adapt.config.get('_spoor')._tracking._excludeAssessments,
                data = new Array(Adapt.course.get('_latestTrackingId') + 1);

            for (var i = 0; i < data.length; i++) {
                data[i] = -1;
            }

            _.each(Adapt.blocks.models, function(model, index) {
                var _trackingId = model.get('_trackingId'),
                    isPartOfAssessment = model.getParent().get('_assessment'),
                    state = model.get(attribute) ? 1: 0;

                if(excludeAssessments && isPartOfAssessment) {
                    state = 0;
                }

                if (_trackingId === undefined) {
                    var message = "Block '" + model.get('id') + "' doesn't have a tracking ID assigned.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                    console.error(message);
                }

                data[_trackingId] = state;
            }, this);

            return data.join("").replace(/-1/g, "-");
        },

        deserialise: function (data) {
            var suspendData = JSON.parse(data);

            _.each(this.deserialiseSaveState(suspendData.spoor.completion), function(state, blockTrackingId) {
                if (state === 1) {
                    this.markBlockAsComplete(Adapt.blocks.findWhere({_trackingId: blockTrackingId}));
                }
            }, this);

            Adapt.course.set('_isComplete', suspendData.spoor._isCourseComplete);
            Adapt.course.set('_isAssessmentPassed', suspendData.spoor._isAssessmentPassed);

            return suspendData;
        },

        markBlockAsComplete: function(block) {
            if (!block || block.get('_isComplete')) {
                return;
            }
        
            block.getChildren().each(function(child) {
                child.set('_isComplete', true);
            }, this);
        },

        deserialiseSaveState: function (string) {
            var completionArray = string.split("");

            for (var i = 0; i < completionArray.length; i++) {
                if (completionArray[i] === "-") {
                    completionArray[i] = -1;
                } else {
                    completionArray[i] = parseInt(completionArray[i], 10);
                }
            }

            return completionArray;
        }

    };
});