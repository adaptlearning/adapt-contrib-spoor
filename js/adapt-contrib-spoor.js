/*
* adapt-contrib-spoor
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Kevin Corry <kevinc@learningpool.com>
*/
define(function(require) {

  var Adapt = require('coreJS/adapt');
  var scormAPI = require('extensions/adapt-contrib-spoor/js/SCORM_API_wrapper');
  var scormWrapper = require('extensions/adapt-contrib-spoor/js/scormWrapper').getInstance();
  var scormLog = require('extensions/adapt-contrib-spoor/js/logger');
  
  var Spoor = Backbone.Model.extend({

    defaults: {
      initialised: false,
      SCOFinishCalled: false,
      testingMode: false
    },

    initialize: function() {
      //_.bindAll(this);
        this.data = Adapt.config.get('_spoor');
        console.log(scormWrapper);
        this.SCOStart() 
        $(window).unload(_.bind(this.SCOFinish, this));
        this.onDataReady();
    },

    checkCompletionCriteria: function() {
      var requirementArray = [this.data._tracking._requireCourseCompleted, this.data._tracking._requireAssessmentPassed];
      var actualArray = [Adapt.course.get('_isComplete'), Adapt.course.get('_isAssessmentPassed')];
      
      var criteriaMet = true;

      _.each(requirementArray, function(requirement, index) {
        if(requirement) {
          if(!actualArray[index]) {
            criteriaMet = false;
          }
        }
      }, this);

      if(criteriaMet) {
        this.setLessonStatus(this.data._reporting.onTrackingCriteriaMet);
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
      var _blockCompletionArray = this.get('_blockCompletionArray');

      _.each(Adapt.blocks.models, function(blockModel) {
        if (blockModel.get('_isComplete')) {
          _blockCompletionArray[blockModel.get('_trackingId')] =  1;
        }
      }, this);

      this.set('_blockCompletionArray', _blockCompletionArray);
      return this.convertCompletionArrayToString(_blockCompletionArray);
    },

    createCompletionObject: function() {
      var completionObject = {spoor:{}};
      completionObject.spoor.completion = this.createCompletionString();
      completionObject.spoor._isAssessmentPassed = Adapt.course.get('_isAssessmentPassed') || false;
      this.set('completionObject', completionObject);
      return completionObject;
    },

    getDataIsAlreadyReported: function(completionObject) {
      return JSON.stringify(this.get('_suspendData')) === JSON.stringify(completionObject);
    },

    markBlockAsComplete: function(parameters) {
      var block = parameters.block;

      if (block.get('_isComplete')) {
        return;
      }

      block.getChildren().each(function(child) {
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
      this.listenToCompletionEvents();
      console.log(Adapt.blocks);
      // may no longer be needed - DH
//      Adapt.trigger("spoorReady");
    },
    
    listenToCompletionEvents: function() {
      Adapt.blocks.on('change:_isComplete', this.onBlockComplete, this);
      Adapt.course.on('change:_isComplete', this.onCourseComplete, this);
      Adapt.on('assessment:complete', this.onAssessmentComplete, this);
    },
      
    onCourseComplete: function() {
      this.onCriterionMet("_isComplete");
    },
    
    onBlockComplete: function(block) {
      this.set('lastCompletedBlock', block);
      this.sendCompletionString();
    },
    
    onAssessmentComplete: function(event) {
      var _isAssessmentPassed = event.isPass;
      console.info("Spoor::onAssessmentComplete: assessment: " + isAssessment + ", _isAssessmentPassed: " + _isAssessmentPassed);
      if (_isAssessmentPassed) {
        this.onCriterionMet("_isAssessmentPassed");
      } else {
        var onAssessmentFailure = this.data._reporting.onAssessmentFailure;
        if (onAssessmentFailure !== "" && onAssessmentFailure !== "incomplete") {
          this.setLessonStatus(onAssessmentFailure);
        }
      }
    },

    repopulateCompletionData: function() {
      var suspendData = this.get('_suspendData');

      if (suspendData.spoor.completion !== "") {
        this.restoreProgress(suspendData);
      }
    },

    restoreProgress: function(suspendData) {
      if (scormWrapper.getStatus() === "courseComplete") {
        Adapt.course.setOnChildren('_isComplete', true);
      } else {
        _.each(this.get('_blockCompletionArray'), function(blockCompletion, blockTrackingId) {
          if (blockCompletion === 1) {
            this.markBlockAsComplete({block: Adapt.blocks.findWhere({_trackingId: blockTrackingId}), includeChildren: true});
          }
        }, this);
      }
      Adapt.course.set('_isAssessmentPassed', suspendData.spoor._isAssessmentPassed);
      this.set('_suspendData', suspendData);
      this.sendCompletionString();
    },

    SCOFinish:function() {
      if (!this.get('_SCOFinishCalled')) {
        this.set('SCOFinishCalled', true);
        scormWrapper.finish();
      }
    },

    SCOStart: function() {
      // this.set('scormWrapper', this.data._testingMode') ? this.get('testingLMS : ScormWrapper.getInstance());
      var sw = scormWrapper;
      if (sw.initialize()) {
        sw.setVersion("1.2");
        this.set('initialised', true);
        var lessonStatus = sw.getStatus().toLowerCase();

        if (lessonStatus == "not attempted" || lessonStatus == "unknown") {
          sw.setIncomplete();
        }
      }
    },

    sendCompletionString: function(){
      console.log('sendCompletionString');
      var suspendData = this.createCompletionObject();
      if (!this.getDataIsAlreadyReported(suspendData)) {
        if (this.get('_lastCompletedBlock') !== undefined) {
          console.info("Spoor: block " + this.get('_lastCompletedBlock').get('id') + " is complete.");
        }
        this.set({
          _suspendData: suspendData, 
          _blockCompletionArray: this.convertCompletionStringToArray(suspendData.spoor.completion)
        });
        scormWrapper.setSuspendData(JSON.stringify(suspendData));
      }
    },

    setLessonStatus:function(status){
      switch (status){
        case "incomplete":
          scormWrapper.setIncomplete();
          break;
        case "completed":
          scormWrapper.setCompleted();
          break;
        case "passed":
          scormWrapper.setPassed();
          break;
        case "failed":
          scormWrapper.setFailed();
          break;
        default:
          console.warn("cmi.core.lesson_status of " + status + " is not supported.");
          break;
      }
    },

    setScore: function(score){
      scormWrapper.setScore(score,0,100);
    },

    setSessionData: function() {
      var suspendData = scormWrapper.getSuspendData();

      if (suspendData === "" || suspendData === " " || suspendData === undefined) {
        this.set('_suspendData', {
          spoor: {
            completion: "",
            _isAssessmentPassed: false
          }
        });
      } else {
        this.set('_suspendData', JSON.parse(suspendData));
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
      if (Adapt.course.get('_latestTrackingId') === undefined) {
        var message = "This course is missing a latestTrackingID.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
        alert(message);
        console.error(message);
      }
      var _blockCompletionArray = new Array(Adapt.course.get('_latestTrackingId') + 1);
      for (var i = 0; i < _blockCompletionArray.length; i++) {
        _blockCompletionArray[i] = -1;
      }

      _.each(Adapt.blocks.models, function(model, index) {
        var _trackingId = model.get('_trackingId');
        var recordedCompletion = parseInt(this.get('_suspendData').spoor.completion[_trackingId], 10) || 0;
        if (_trackingId === undefined) {
          var message = "Block '" + model.get('id') + "' doesn't have a tracking ID assigned.\n\nPlease run the grunt process prior to deploying this module on LMS.\n\nScorm tracking will not work correctly until this is done.";
          alert(message);
          console.error(message);
        }
        _blockCompletionArray[_trackingId] = recordedCompletion;
      }, this);
      this.set('_blockCompletionArray', _blockCompletionArray);
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
  Adapt.on('app:dataReady', function() {
    new Spoor();
  })
});