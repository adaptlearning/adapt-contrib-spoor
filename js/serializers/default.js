define([
    'core/js/adapt'
], function (Adapt) {

    //Captures the completion status of the blocks
    //Returns and parses a '1010101' style string

    var serializer = {
        serialize: function () {
            return this.serializeSaveState('_isComplete');
        },

        serializeSaveState: function(attribute) {
            if (Adapt.course.get('_latestTrackingId') === undefined) {
                var message = "This course is missing a latestTrackingID.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                console.error(message);
            }

            var excludeAssessments = Adapt.config.get('_spoor') && Adapt.config.get('_spoor')._tracking && Adapt.config.get('_spoor')._tracking._excludeAssessments;

            // create the array to be serialised, pre-populated with dashes that represent unused tracking ids - because we'll never re-use a tracking id in the same course
            var data = [];
            var length = Adapt.course.get('_latestTrackingId') + 1;
            for (var i = 0; i < length; i++) {
                data[i] = "-";
            }

            // now go through all the blocks, replacing the appropriate dashes with 0 (incomplete) or 1 (completed) for each of the blocks
            _.each(Adapt.blocks.models, function(model, index) {
                var _trackingId = model.get('_trackingId'),
                    isPartOfAssessment = model.getParent().get('_assessment'),
                    state = model.get(attribute) ? 1: 0;

                if(excludeAssessments && isPartOfAssessment) {
                    state = 0;
                }

                if (_trackingId === undefined) {
                    var message = "Block '" + model.get('_id') + "' doesn't have a tracking ID assigned.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
                    console.error(message);
                } else {
                    data[_trackingId] = state;
                }
            }, this);

            return data.join("");
        },

        deserialize: function (completion) {
            var idStateHash = this.deserializeSaveState(completion);
            var blockIdHash = {};

            for (var i = 0, l = Adapt.blocks.models.length; i < l; i++) {
                var blockModel = Adapt.blocks.models[i];
                blockIdHash[blockModel.attributes._trackingId] = blockModel;
            }

            for (var blockTrackingId = 0, l = idStateHash.length; blockTrackingId < l; blockTrackingId++) {
                var state = idStateHash[blockTrackingId];
                if (state === 1) {
                    this.markBlockAsComplete(blockIdHash[blockTrackingId]);
                }
            }

        },    

        deserializeSaveState: function (string) {
            var completionArray = string.split("");

            for (var i = 0; i < completionArray.length; i++) {
                if (completionArray[i] === "-") {
                    completionArray[i] = -1;
                } else {
                    completionArray[i] = parseInt(completionArray[i], 10);
                }
            }

            return completionArray;
        },

        markBlockAsComplete: function(block) {
            if (!block) {
                return;
            }

            _.defer(function() {
                block.setOnChildren("_isComplete", true);
            });

        }

    };

    return serializer;
});
