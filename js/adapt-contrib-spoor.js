/*
* adapt-contrib-spoor
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Kevin Corry <kevinc@learningpool.com>
*/
define(function(require) {

  var Adapt = require('coreJS/adapt'),
      _ = require('underscore'),
      scormAPI = require('extensions/adapt-contrib-spoor/js/SCORM_API_wrapper'),
      scormWrapper = require('extensions/adapt-contrib-spoor/js/scormWrapper').getInstance(),
      scormLog = require('extensions/adapt-contrib-spoor/js/logger'),
      serialiser = require('./serialisers/default');

  var Spoor = Backbone.Model.extend({

    defaults: {
      initialised: false,
      SCOFinishCalled: false,
      testingMode: false
    },

    initialize: function() {
      this.data = Adapt.config.get('_spoor');
      this.SCOStart() ;
      $(window).unload(_.bind(this.SCOFinish, this));
      this.onDataReady();
    },

    SCOStart: function() {
      if (scormWrapper.initialize()) {
				/**
				* force use of SCORM 1.2 - as some LMSes (SABA, for instance) present both APIs to the SCO and, if given the choice, 
				* the pipwerks code will automatically select the SCORM 2004 API - which can lead to unexpected behaviour.
				* this does obviously mean you'll have to manually change (or just remove) this next line if you want SCORM 2004 output
				*/
				//TODO allow version to be set via config.json
        scormWrapper.setVersion("1.2");
        this.set('initialised', true);
      }
    },

    SCOFinish:function() {
      if (!this.get('_SCOFinishCalled')) {
        this.set('SCOFinishCalled', true);
        scormWrapper.finish();
      }
    },

    onDataReady: function() {
      this.loadSuspendData();
      this.assignSessionId();
      this.setupListeners();
    },

    setupListeners: function() {
      Adapt.blocks.on('change:_isComplete', this.onBlockComplete, this);
      Adapt.course.on('change:_isComplete', this.onCourseComplete, this);
      Adapt.on('assessment:complete', this.onAssessmentComplete, this);
      Adapt.on('questionView:complete', this.onQuestionComplete, this);
      Adapt.on('questionView:reset', this.onQuestionReset, this);
    },

    loadSuspendData: function() {
      var suspendData = scormWrapper.getSuspendData();

      if (suspendData === "" || suspendData === " " || suspendData === undefined) {
        this.set('_suspendData', serialiser.serialise());
      } else {
        this.set('_suspendData', serialiser.deserialise(suspendData));
      }
    },

    assignSessionId: function () {
      this.set({
        _sessionID: Math.random().toString(36).slice(-8)
      });
    },

    onBlockComplete: function(block) {
      this.set('lastCompletedBlock', block);
      this.persistSuspendData();
    },

    onCourseComplete: function() {
      if(Adapt.course.get('_isComplete') === true) {
        this.set('_attempts', this.get('_attempts')+1);
      }
      _.defer(function waitForBlockComplete() {
        this.persistSuspendData();
      });
    },

    onAssessmentComplete: function(event) {
      if(this.data._tracking._shouldSubmitScore) {
        scormWrapper.setScore(event.scoreAsPercent, 0, 100);
      }
      if (event.isPass) {
        Adapt.course.set('_isAssessmentPassed', event.isPass);
        this.persistSuspendData();
      } else {
        var onAssessmentFailure = this.data._reporting._onAssessmentFailure;
        if (onAssessmentFailure !== "" && onAssessmentFailure !== "incomplete") {
          this.setLessonStatus(onAssessmentFailure);
        }
      }
    },

    onQuestionComplete: function(questionView) {
      questionView.model.set('_sessionID', this.get('_sessionID'));
    },

    onQuestionReset: function(questionView) {
      if(this.get('_sessionID') !== questionView.model.get('_sessionID')) {
          questionView.model.set('_isEnabledOnRevisit', true);
      }
    },

    repopulateCompletionData: function() {
      var suspendData = this.get('_suspendData');

      if (suspendData.spoor.completion !== "") {
        this.restoreProgress(suspendData);
      }
    },

    restoreProgress: function(suspendData) {
      if (suspendData.spoor.completion === "courseComplete") {
        Adapt.course.set('_isComplete', true);
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
				/**
				* force use of version SCORM 1.2 as some LMSes (SABA, for instance) present both APIs and, if given the choice, 
				* the pipwerks code will automatically select the SCORM 2004 API - which can lead to unexpected behaviour.
				*/
        sw.setVersion("1.2");
        this.set('initialised', true);
      }
    },
    persistSuspendData: function(){
      var courseCriteriaMet = this.data._tracking._requireCourseCompleted ? Adapt.course.get('_isComplete') : true,
          assessmentCriteriaMet = this.data._tracking._requireAssessmentPassed ? Adapt.course.get('_isAssessmentPassed') : true;

      if(courseCriteriaMet && assessmentCriteriaMet) {
        this.setLessonStatus(this.data._reporting._onTrackingCriteriaMet);
      }
      scormWrapper.setSuspendData(JSON.stringify(serialiser.serialise()));
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
    }
    
  });
  Adapt.on('app:dataReady', function() {
    new Spoor();
  });
});