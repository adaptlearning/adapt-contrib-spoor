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
		/**
		* force use of SCORM 1.2 - as some LMSes (SABA, for instance) present both APIs to the SCO and, if given the choice, 
		* the pipwerks code will automatically select the SCORM 2004 API - which can lead to unexpected behaviour.
		* this does obviously mean you'll have to manually change (or just remove) this next line if you want SCORM 2004 output
		*/
		//TODO allow version to be set via config.json
        scormWrapper.setVersion("1.2");

		if (scormWrapper.initialize()) {
			this.set('initialised', true);
		}
    },

    SCOFinish: function() {
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
      _.defer(_.bind(this.checkTrackingCriteriaMet, this));
    },

    onAssessmentComplete: function(event) {
		Adapt.course.set('_isAssessmentPassed', event.isPass)
		
		this.persistSuspendData();

		if(this.data._tracking._shouldSubmitScore) {
			scormWrapper.setScore(event.scoreAsPercent, 0, 100);
		}

		if (event.isPass) {
			_.defer(_.bind(this.checkTrackingCriteriaMet, this));
		} else {
			var onAssessmentFailure = this.data._reporting._onAssessmentFailure;
			if (onAssessmentFailure !== "") {
				this.persistSuspendData();
				scormWrapper.setStatus(onAssessmentFailure);
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

    persistSuspendData: function() {
		scormWrapper.setSuspendData(JSON.stringify(serialiser.serialise()));
	},
	
	checkTrackingCriteriaMet: function() {
		var courseCriteriaMet = this.data._tracking._requireCourseCompleted ? Adapt.course.get('_isComplete') : true;
		var assessmentCriteriaMet = this.data._tracking._requireAssessmentPassed ? Adapt.course.get('_isAssessmentPassed') : true;
		
		if(courseCriteriaMet && assessmentCriteriaMet) {
			scormWrapper.setStatus(this.data._reporting._onTrackingCriteriaMet);
		}
	}
    
  });
  Adapt.on('app:dataReady', function() {
    new Spoor();
  });
});