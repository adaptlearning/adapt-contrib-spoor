define([
  'core/js/adapt',
  './serializers/default',
  './serializers/questions',
  'core/js/enums/completionStateEnum'
], function(Adapt, serializer, questions, COMPLETION_STATE) {

  // Implements Adapt session statefulness

  var AdaptStatefulSession = _.extend({

    _config: null,
    _shouldStoreResponses: true,
    _shouldRecordInteractions: true,

    // Session Begin
    initialize: function(callback) {
      this._onWindowUnload = this.onWindowUnload.bind(this);

      this.getConfig();

      this.getLearnerInfo();

      // Restore state asynchronously to prevent IE8 freezes
      this.restoreSessionState(function() {
        // still need to defer call because AdaptModel.check*Status functions are asynchronous
        _.defer(this.setupEventListeners.bind(this));
        callback();
      }.bind(this));
    },

    getConfig: function() {
      this._config = Adapt.config.has('_spoor') ? Adapt.config.get('_spoor') : false;

      this._shouldStoreResponses = (this._config && this._config._tracking && this._config._tracking._shouldStoreResponses);

      // Default should be to record interactions, so only avoid doing that if _shouldRecordInteractions is set to false
      if (this._config && this._config._tracking && this._config._tracking._shouldRecordInteractions === false) {
        this._shouldRecordInteractions = false;
      }
    },

    /**
     * Replace the hard-coded _learnerInfo data in _globals with the actual data from the LMS
     * If the course has been published from the AT, the _learnerInfo object won't exist so we'll need to create it
     */
    getLearnerInfo: function() {
      var globals = Adapt.course.get('_globals');
      if (!globals._learnerInfo) {
        globals._learnerInfo = {};
      }
      _.extend(globals._learnerInfo, Adapt.offlineStorage.get("learnerinfo"));
    },

    saveSessionState: function() {
      var sessionPairs = this.getSessionState();
      Adapt.offlineStorage.set(sessionPairs);
    },

    restoreSessionState: function(callback) {
      var sessionPairs = Adapt.offlineStorage.get();
      var hasNoPairs = _.keys(sessionPairs).length === 0;

      var doSynchronousPart = function() {
        if (sessionPairs.questions && this._shouldStoreResponses) questions.deserialize(sessionPairs.questions);
        if (sessionPairs._isCourseComplete) Adapt.course.set('_isComplete', sessionPairs._isCourseComplete);
        if (sessionPairs._isAssessmentPassed) Adapt.course.set('_isAssessmentPassed', sessionPairs._isAssessmentPassed);
        callback();
      }.bind(this);

      if (hasNoPairs) return callback();

      // Asynchronously restore block completion data because this has been known to be a choke-point resulting in IE8 freezes
      if (sessionPairs.completion) {
        serializer.deserialize(sessionPairs.completion, doSynchronousPart);
      } else {
        doSynchronousPart();
      }
    },

    getSessionState: function() {
      var sessionPairs = {
        "completion": serializer.serialize(),
        "questions": (this._shouldStoreResponses === true ? questions.serialize() : ""),
        "_isCourseComplete": Adapt.course.get("_isComplete") || false,
        "_isAssessmentPassed": Adapt.course.get('_isAssessmentPassed') || false
      };
      return sessionPairs;
    },

    // Session In Progress
    setupEventListeners: function() {
      $(window).on('beforeunload unload', this._onWindowUnload);

      if (this._shouldStoreResponses) {
        this.listenTo(Adapt.components, 'change:_isInteractionComplete', this.onQuestionComponentComplete);
      }

      if (this._shouldRecordInteractions) {
        this.listenTo(Adapt, 'questionView:recordInteraction', this.onQuestionRecordInteraction);
      }

      this.listenTo(Adapt.blocks, 'change:_isComplete', this.onBlockComplete);
      this.listenTo(Adapt, {
        'assessment:complete': this.onAssessmentComplete,
        'app:languageChanged': this.onLanguageChanged,
        'tracking:complete': this.onTrackingComplete
      });
    },

    removeEventListeners: function () {
      $(window).off('beforeunload unload', this._onWindowUnload);
      this.stopListening();
    },

    reattachEventListeners: function() {
      this.removeEventListeners();
      this.setupEventListeners();
    },

    onBlockComplete: function(block) {
      this.saveSessionState();
    },

    onQuestionComponentComplete: function(component) {
      if (!component.get("_isQuestionType")) return;

      this.saveSessionState();
    },

    onTrackingComplete: function(completionData) {
      this.saveSessionState();

      var completionStatus = completionData.status.asLowerCase;

      // The config allows the user to override the completion state.
      switch (completionData.status) {
        case COMPLETION_STATE.COMPLETED:
        case COMPLETION_STATE.PASSED: {
          if (!this._config._reporting._onTrackingCriteriaMet) {
            Adapt.log.warn("No value defined for '_onTrackingCriteriaMet', so defaulting to '" + completionStatus + "'");
          } else {
            completionStatus = this._config._reporting._onTrackingCriteriaMet;
          }

          break;
        }

        case COMPLETION_STATE.FAILED: {
          if (!this._config._reporting._onAssessmentFailure) {
            Adapt.log.warn("No value defined for '_onAssessmentFailure', so defaulting to '" + completionStatus + "'");
          } else {
            completionStatus = this._config._reporting._onAssessmentFailure;
          }
        }
      }

      Adapt.offlineStorage.set("status", completionStatus);
    },

    onAssessmentComplete: function(stateModel) {
      Adapt.course.set('_isAssessmentPassed', stateModel.isPass);

      this.saveSessionState();

      this.submitScore(stateModel);
    },

    onQuestionRecordInteraction:function(questionView) {
      var responseType = questionView.getResponseType();

      // If responseType doesn't contain any data, assume that the question
      // component hasn't been set up for cmi.interaction tracking
      if(_.isEmpty(responseType)) return;

      var id = questionView.model.get('_id');
      var response = questionView.getResponse();
      var result = questionView.isCorrect();
      var latency = questionView.getLatency();

      Adapt.offlineStorage.set("interaction", id, response, result, latency, responseType);
    },

    /**
     * when the user switches language, we need to:
     * - reattach the event listeners as the language change triggers a reload of the json, which will create brand new collections
     * - get and save a fresh copy of the session state. as the json has been reloaded, the blocks completion data will be reset (the user is warned that this will happen by the language picker extension)
     * - check to see if the config requires that the lesson_status be reset to 'incomplete'
     */
    onLanguageChanged: function () {
      this.reattachEventListeners();

      this.saveSessionState();

      if (this._config._reporting && this._config._reporting._resetStatusOnLanguageChange === true) {
        Adapt.offlineStorage.set("status", "incomplete");
      }
    },

    submitScore: function(stateModel) {
      if (this._config && !this._config._tracking._shouldSubmitScore) return;

      if (stateModel.isPercentageBased) {
        Adapt.offlineStorage.set("score", stateModel.scoreAsPercent, 0, 100);
      } else {
        Adapt.offlineStorage.set("score", stateModel.score, 0, stateModel.maxScore);
      }
    },

    // Session End
    onWindowUnload: function() {
      this.removeEventListeners();
    }

  }, Backbone.Events);

  return AdaptStatefulSession;

});
