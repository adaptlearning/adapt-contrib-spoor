/*
* adapt-contrib-spoor
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Kevin Corry <kevinc@learningpool.com>
*/
define(function(require) {

  var Adapt = require('coreJS/adapt');
  var sAPI = require('extensions/adapt-contrib-spoor/js/SCORM_API_wrapper');
  var sWrapper = require('extensions/adapt-contrib-spoor/js/scormWrapper');
  var sLog = require('extensions/adapt-contrib-spoor/js/logger');
  
  var Spoor = Backbone.Model.extend({

    defaults: {
      initialised: false,
      SCOFinishCalled: false,
      dataIsFromLMS: true,
      testingMode: false
    },

    url: "spoor/scormData.json",

    initialize: function() {
      //_.bindAll(this);
      this.fetch();
      this.SCOStart();
    },
    
    init: function() {
      if (Adapt.course !== undefined && Adapt.course.get('dataReady')) {
        this.onDataReady();
      } else {
        Adapt.on('app:dataReady', this.onDataReady, this);
      }
      //Adapt.blocks.on('change:_isComplete', this.onItemComplete, this);
      Adapt.on('itemComplete', this.onItemComplete, this);
    },

    checkCompletionCriteria: function() {
      var needModsComplete = this.get('tracking').requireAllModulesCompleted;
      var needQuizPassed = this.get('tracking').requireQuizPassed;

      needModsComplete = this.parseBool(needModsComplete);
      needQuizPassed = this.parseBool(needQuizPassed);

      var quizPassed = !!Adapt.course.get('quizPassed');
      var modulesCompleted = !!Adapt.course.get('_isComplete');
      var trackingCriteriaMet = false;

      if (needModsComplete) {
        if (modulesCompleted) {
          if (needQuizPassed) {
            if (quizPassed) {
              trackingCriteriaMet = true;
            }
          } else {
            trackingCriteriaMet = true;
          }
        }
      } else {
        if (needQuizPassed) {
          if (quizPassed) {
            trackingCriteriaMet = true;
          }
        }
      }
      if (trackingCriteriaMet) {
        this.setLessonStatus(this.get('reporting').onTrackingCriteriaMet);
      }
    },

    convertCompletionStringToArray: function(string) {
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

    convertCompletionArrayToString: function(array) {
      var completionString = array.join("");
      return completionString.replace(/-1/g, "-");
    },

    createCompletionString: function() {
      var blockCompletionArray = this.get('blockCompletionArray');

      _.each(Adapt.blocks.models, function(blockModel) {
        if (blockModel.get('_isComplete')) {
          blockCompletionArray[blockModel.get('trackingId')] =  1;
        }
      }, this);

      this.set('blockCompletionArray', blockCompletionArray);
      return this.convertCompletionArrayToString(blockCompletionArray);
    },

    createCompletionObject: function() {
      var completionObject = {spoor:{}};
      completionObject.spoor.completion = this.createCompletionString();
      completionObject.spoor.quizPassed = Adapt.course.get('quizPassed') || false;
      this.set('completionObject', completionObject);
      return completionObject;
    },

    getDataIsAlreadyReported: function(completionObject) {
      return JSON.stringify(this.get('suspendData')) === JSON.stringify(completionObject);
    },

    markBlockAsComplete: function(parameters) {
      var block = parameters.block;

      if (block.get('_isComplete')) {
        return;
      }

      _.each(block.getChildren(), function(child) {
        child.set('_isComplete', true);
      }, this);
    },

    onCriterionMet: function(criterion) {
      if (!Adapt.course.get(criterion)) {
        Adapt.course.set(criterion, true);
      }
      this.sendCompletionString();
      this.checkCompletionCriteria();
    },

    onDataReady: function() {
      this.setSessionData();
      this.setupBlockCompletionData();
      this.repopulateCompletionData();
      Adapt.trigger("spoorReady");
    },

    onItemComplete: function(item) {
      console.log('onItemComplete');
      if(!this.get('dataIsFromLMS')) {
        switch(item.get('_type')) {
          case "course":
            this.onCriterionMet("complete");
            break;
          case "block":
            this.set('lastCompletedBlock', item);
            this.sendCompletionString();
            break;
        }
      }
    },

    onQuizComplete: function(isAssessment, quizPassed) {
      console.info("Spoor::onQuizComplete: assessment: " + isAssessment + ", quizPassed: " + quizPassed);
      if (isAssessment) {
        if (quizPassed) {
          this.onCriterionMet("quizPassed");
        } else {
          var onQuizFailure = this.get('reporting').onQuizFailure;
          if (onQuizFailure !== "" && onQuizFailure !== "incomplete") {
            this.setLessonStatus(onQuizFailure);
          }
        }
      }
    },

    repopulateCompletionData: function() {
      var suspendData = this.get('suspendData');

      if (suspendData.spoor.completion !== "") {
        this.restoreProgress(suspendData);
      }

      this.set('dataIsFromLMS', false);
    },

    restoreProgress: function(suspendData) {
      if (this.get('scormWrapper').getStatus() === "courseComplete") {
        Adapt.course.setOnChildren('_isComplete', true);
      } else {
        _.each(this.get('blockCompletionArray'), function(blockCompletion, blockTrackingId) {
          if (blockCompletion === 1) {
            this.markBlockAsComplete({block: Adapt.blocks.findWhere({trackingId: blockTrackingId}), includeChildren: true});
          }
        }, this);
      }
      Adapt.course.set('quizPassed', suspendData.spoor.quizPassed);
      this.set("suspendData", suspendData);
      this.sendCompletionString();
    },

    SCOFinish:function() {
      if (!this.get('SCOFinishCalled')) {
        this.set('SCOFinishCalled', true);
        this.get('scormWrapper').finish();
      }
    },

    SCOStart: function() {
      this.set('scormWrapper', this.get('testingMode') ? this.get('testingLMS') : ScormWrapper.getInstance());
      var sw = this.get('scormWrapper');
      sw.setVersion("1.2");
      if (sw.initialize()) {
        this.set('initialised', true);
        var lessonStatus = sw.getStatus().toLowerCase();

        if (lessonStatus == "not attempted" || lessonStatus == "unknown") {
          sw.setIncomplete();
        }
        this.init();
      }
    },

    sendCompletionString: function(){
      console.log('sendCompletionString');
      var suspendData = this.createCompletionObject();
      if (!this.getDataIsAlreadyReported(suspendData)) {
        if (this.get('lastCompletedBlock') !== undefined) {
          console.info("Spoor: block " + this.get('lastCompletedBlock').get('id') + " is complete.");
        }
        this.set({
          suspendData: suspendData, 
          blockCompletionArray: this.convertCompletionStringToArray(suspendData.spoor.completion)
        });
        this.get('scormWrapper').setSuspendData(JSON.stringify(suspendData));
      }
    },

    setLessonStatus:function(status){
      switch (status){
        case "incomplete":
          this.get('scormWrapper').setIncomplete();
          break;
        case "completed":
          this.get('scormWrapper').setCompleted();
          break;
        case "passed":
          this.get('scormWrapper').setPassed();
          break;
        case "failed":
          this.get('scormWrapper').setFailed();
          break;
        default:
          console.warn("cmi.core.lesson_status of " + status + " is not supported.");
          break;
      }
    },

    setScore: function(score){
      this.get('scormWrapper').setScore(score,0,100);
    },

    setSessionData: function() {
      var suspendData = this.get('scormWrapper').getSuspendData();

      if (suspendData === "" || suspendData === " " || suspendData === undefined) {
        this.set('suspendData', {
          spoor: {
            completion: "",
            quizPassed: false
          }
        });
      } else {
        this.set('suspendData', JSON.parse(suspendData));
      }

      this.set({
        sessionID: this.generateRandomID(8)
      });
    },

    setTestingMode: function(value) {
      this.set('testingLMS', value ? new TestingLMS() : null);
      this.set('testingMode', value);
    },

    setupBlockCompletionData: function() {
      if (Adapt.course.get('latestTrackingId') === undefined) {
        var message = "This course is missing a latestTrackingID.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
        alert(message);
        console.error(message);
      }
      var blockCompletionArray = new Array(Adapt.course.get('latestTrackingId') + 1);
      for (var i = 0; i < blockCompletionArray.length; i++) {
        blockCompletionArray[i] = -1;
      }

      _.each(Adapt.blocks.models, function(model, index) {
        var trackingId = model.get('trackingId');
        var recordedCompletion = parseInt(this.get('suspendData').spoor.completion[trackingId], 10) || 0;
        if (trackingId === undefined) {
          var message = "Block '" + model.get('id') + "' doesn't have a tracking ID assigned.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
          alert(message);
          console.error(message);
        }
        blockCompletionArray[trackingId] = recordedCompletion;
      }, this);
      this.set('blockCompletionArray', blockCompletionArray);
    },

    parseBool: function(str) {
        if(_.isString(str)) { 
            if (typeof str === 'string' && str.toLowerCase() == 'true')
                return true;
            return (parseInt(str) > 0);
        } else if (_.isBoolean(str)) return str;
    },

    generateRandomID: function(numberOfCharacters) {
        return Math.random().toString(36).slice(-numberOfCharacters);
    }

  });

  return new Spoor();

});
