define([
    'coreJS/adapt',
    './scormSuspendDataSerializer'
], function (Adapt) {

    //Captures the completion status and user selections of the question components
    //Returns and parses a base64 style string

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
            
            var components = Adapt.components.toJSON();

            var includes = {
                "_isQuestionType": true,
                "_isResetOnRevisit": false
            };

            components = _.where(components, includes);

            var blocks = {};
            var countInBlock = {};

            for (var i = 0, l = components.length; i < l; i++) {
                var component = components[i];
                var blockId = component._parentId;

                if (!blocks[blockId]) {
                    blocks[blockId] = Adapt.findById(blockId).toJSON();
                }

                var block = blocks[blockId];
                if (countInBlock[blockId] === undefined) countInBlock[blockId] = -1;
                countInBlock[blockId]++;

                var blockLocation = countInBlock[blockId];

                if (component['_isInteractionComplete'] === false || component['_isComplete'] === false) {
                    //if component is not currently complete skip it
                    continue;
                }

                if (block['_trackingId'] === undefined) {
                    //if block has no tracking id, skip it
                    continue;
                }

                var hasUserAnswer = (component['_userAnswer'] !== undefined);
                var isUserAnswerArray = (component['_userAnswer'] instanceof Array);


                var numericParameters = [
                        blockLocation,
                        block['_trackingId'],
                        component['_score'] || 0
                    ];

                var booleanParameters = [
                        hasUserAnswer,
                        isUserAnswerArray,
                        component['_isInteractionComplete'],
                        component['_isSubmitted'],
                        component['_isCorrect'] || false
                    ];

                var dataItem = [
                    numericParameters,
                    booleanParameters
                ];


                if (hasUserAnswer) {
                    var userAnswer = isUserAnswerArray ? component['_userAnswer'] : [component['_userAnswer']];

                    var arrayType = SCORMSuspendData.DataType.getArrayType(userAnswer);

                    switch(arrayType.name) {
                    case "string": case "variable":
                        console.log("Cannot store _userAnswers from component " + component._id + " as array is of variable or string type.");
                        continue;
                    }

                    dataItem.push(userAnswer);
                }

                data.push(dataItem);

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
            
            for (var i = 0, l = arr.length; i < l; i++) {
                var dataItem = arr[i];

                var numericParameters = dataItem[0];
                var booleanParameters = dataItem[1];

                var blockLocation = numericParameters[0];
                var trackingId = numericParameters[1];
                var score = numericParameters[2];

                var hasUserAnswer = booleanParameters[0];
                var isUserAnswerArray = booleanParameters[1];
                var isInteractionComplete = booleanParameters[2];
                var isSubmitted = booleanParameters[3];
                var isCorrect = booleanParameters[4];

                var block = Adapt.blocks.findWhere({_trackingId: trackingId});
                var component = block.getChildren().models[blockLocation];

                component.set("_isComplete", true);
                component.set("_isInteractionComplete", isInteractionComplete);
                component.set("_isSubmitted", isSubmitted);
                component.set("_score", score);
                component.set("_isCorrect", isCorrect);

                if (hasUserAnswer) {
                    var userAnswer = dataItem[2];
                    if (!isUserAnswerArray) userAnswer = userAnswer[0];

                    component.set("_userAnswer", userAnswer);
                }


            }
        }
    };

    return serializer;
});
