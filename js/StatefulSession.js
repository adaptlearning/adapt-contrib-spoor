define([
  'core/js/adapt',
  './scorm/ScormWrapper',
  './ComponentSerializer',
  'core/js/enums/completionStateEnum',
  'libraries/SCORMSuspendData'
], function(Adapt, ScormWrapper, ComponentSerializer, COMPLETION_STATE, SCORMSuspendData) {

  class StatefulSession extends Backbone.Controller {

    initialize() {
      _.bindAll(this, 'beginSession', 'onVisibilityChange', 'endSession');
      this.scorm = ScormWrapper.getInstance();
      this._trackingIdType = 'block';
      this._componentSerializer = null;
      this._shouldStoreResponses = true;
      this._shouldRecordInteractions = true;
      this.beginSession();
    }

    beginSession() {
      this.listenTo(Adapt, 'app:dataReady', this.restoreSession);
      const config = Adapt.spoor.config;
      this._trackingIdType = Adapt.build.get('trackingIdType');
      this._componentSerializer = new ComponentSerializer(this._trackingIdType);
      this._shouldStoreResponses = (config &&
        config._tracking &&
        config._tracking._shouldStoreResponses);
      // Default should be to record interactions, so only avoid doing that if
      // _shouldRecordInteractions is set to false
      if (config && config._tracking && config._tracking._shouldRecordInteractions === false) {
        this._shouldRecordInteractions = false;
      }
      // suppress SCORM errors if 'nolmserrors' is found in the querystring
      if (window.location.search.indexOf('nolmserrors') !== -1) {
        this.scorm.suppressErrors = true;
      }
      if (!config._advancedSettings) {
        // force use of SCORM 1.2 by default - some LMSes (SABA/Kallidus for instance)
        // present both APIs to the SCO and, if given the choice, the pipwerks
        // code will automatically select the SCORM 2004 API - which can lead to
        // unexpected behaviour.
        this.scorm.setVersion('1.2');
        this.scorm.initialize();
        return;
      }
      const settings = config._advancedSettings;
      if (settings._showDebugWindow) {
        this.scorm.showDebugWindow();
      }
      this.scorm.setVersion(settings._scormVersion || '1.2');
      if (settings._suppressErrors) {
        this.scorm.suppressErrors = settings._suppressErrors;
      }
      if (settings._commitOnStatusChange) {
        this.scorm.commitOnStatusChange = settings._commitOnStatusChange;
      }
      if (_.isFinite(settings._timedCommitFrequency)) {
        this.scorm.timedCommitFrequency = settings._timedCommitFrequency;
      }
      if (_.isFinite(settings._maxCommitRetries)) {
        this.scorm.maxCommitRetries = settings._maxCommitRetries;
      }
      if (_.isFinite(settings._commitRetryDelay)) {
        this.scorm.commitRetryDelay = settings._commitRetryDelay;
      }
      if ('_exitStateIfIncomplete' in settings) {
        this.scorm.exitStateIfIncomplete = settings._exitStateIfIncomplete;
      }
      if ('_exitStateIfComplete' in settings) {
        this.scorm.exitStateIfComplete = settings._exitStateIfComplete;
      }
      this.scorm.initialize();
    }

    restoreSession() {
      this.setupLearnerInfo();
      this.restoreSessionState();
      // defer call because AdaptModel.check*Status functions are asynchronous
      _.defer(this.setupEventListeners.bind(this));
    }

    setupLearnerInfo() {
      // Replace the hard-coded _learnerInfo data in _globals with the actual data
      // from the LMS
      // If the course has been published from the AT, the _learnerInfo object
      // won't exist so we'll need to create it
      const globals = Adapt.course.get('_globals');
      if (!globals._learnerInfo) {
        globals._learnerInfo = {};
      }
      Object.assign(globals._learnerInfo, Adapt.offlineStorage.get('learnerinfo'));
    }

    restoreSessionState() {
      const sessionPairs = Adapt.offlineStorage.get();
      const hasNoPairs = _.keys(sessionPairs).length === 0;
      if (hasNoPairs) return;
      if (sessionPairs.c) {
        const [ _isComplete, _isAssessmentPassed ] = SCORMSuspendData.deserialize(sessionPairs.c);
        Adapt.course.set({
          _isComplete,
          _isAssessmentPassed
        });
      }
      if (sessionPairs.q && this._shouldStoreResponses) {
        this._componentSerializer.deserialize(sessionPairs.q);
      }
    }

    setupEventListeners() {
      this.listenTo(Adapt.blocks, 'change:_isComplete', this.saveSessionState);
      this.listenTo(Adapt.course, 'change:_isComplete', this.saveSessionState);
      if (this._shouldStoreResponses) {
        const debouncedSaveSession = _.debounce(this.saveSessionState.bind(this), 1);
        this.listenTo(Adapt.components, 'change:_isSubmitted', debouncedSaveSession);
      }
      this.listenTo(Adapt, {
        'app:languageChanged': this.onLanguageChanged,
        'questionView:recordInteraction': this.onQuestionRecordInteraction,
        'assessment:complete': this.onAssessmentComplete,
        'tracking:complete': this.onTrackingComplete
      });
      const config = Adapt.spoor.config;
      const advancedSettings = config._advancedSettings;
      const shouldCommitOnVisibilityChange = (!advancedSettings ||
          advancedSettings._commitOnVisibilityChangeHidden !== false) &&
          document.addEventListener;
      if (shouldCommitOnVisibilityChange) {
        document.addEventListener('visibilitychange', this.onVisibilityChange);
      }
      $(window).on('beforeunload unload', this.endSession);
    }

    saveSessionState() {
      const courseComplete = Adapt.course.get('_isComplete') || false;
      const assessmentPassed = Adapt.course.get('_isAssessmentPassed') || false;
      const courseState = SCORMSuspendData.serialize([
        courseComplete,
        assessmentPassed
      ]);
      const componentStates = (this._shouldStoreResponses === true) ?
        this._componentSerializer.serialize() :
        '';
      const sessionPairs = {
        'c': courseState,
        'q': componentStates
      };
      this.printCompletionInformation();
      Adapt.offlineStorage.set(sessionPairs);
    }

    printCompletionInformation() {
      const courseComplete = Adapt.course.get('_isComplete') || false;
      const assessmentPassed = Adapt.course.get('_isAssessmentPassed') || false;
      const completion = Adapt.data
        .toArray()
        .filter(model => model.get('_type') === this._trackingIdType && model.has('_trackingId'))
        .sort((a, b) => a.get('_trackingId') - b.get('_trackingId'))
        .map(model => model.get('_isComplete') ? '1' : '0')
        .join('');
      Adapt.log.info(`course._isComplete: ${courseComplete}, course._isAssessmentPassed: ${assessmentPassed}, ${this._trackingIdType}Completion: ${completion}`);
    }

    onLanguageChanged() {
      // when the user switches language, we need to:
      // - reattach the event listeners as the language change triggers a reload of
      //   the json, which will create brand new collections
      // - get and save a fresh copy of the session state. as the json has been reloaded,
      //   the blocks completion data will be reset (the user is warned that this will
      //   happen by the language picker extension)
      // - check to see if the config requires that the lesson_status be reset to
      //   'incomplete'
      const config = Adapt.spoor.config;
      this.removeEventListeners();
      this.setupEventListeners();
      this.saveSessionState();
      if (config._reporting && config._reporting._resetStatusOnLanguageChange === true) {
        Adapt.offlineStorage.set('status', 'incomplete');
      }
    }

    onVisibilityChange() {
      if (document.visibilityState === 'hidden') this.scorm.commit();
    }

    onQuestionRecordInteraction(questionView) {
      if (!this._shouldRecordInteractions) return;
      const responseType = questionView.getResponseType();
      // If responseType doesn't contain any data, assume that the question
      // component hasn't been set up for cmi.interaction tracking
      if (_.isEmpty(responseType)) return;
      const id = questionView.model.get('_id');
      const response = questionView.getResponse();
      const result = questionView.isCorrect();
      const latency = questionView.getLatency();
      Adapt.offlineStorage.set('interaction', id, response, result, latency, responseType);
    }

    onAssessmentComplete(stateModel) {
      const config = Adapt.spoor.config;
      Adapt.course.set('_isAssessmentPassed', stateModel.isPass);
      this.saveSessionState();
      const shouldSubmitScore = (config && config._tracking._shouldSubmitScore);
      const isPercentageBased = stateModel.isPercentageBased;
      if (shouldSubmitScore && isPercentageBased) {
        Adapt.offlineStorage.set('score', stateModel.scoreAsPercent, 0, 100);
      }
      if (shouldSubmitScore && !isPercentageBased) {
        Adapt.offlineStorage.set('score', stateModel.score, 0, stateModel.maxScore);
      }
    }

    onTrackingComplete(completionData) {
      const config = Adapt.spoor.config;
      this.saveSessionState();
      let completionStatus = completionData.status.asLowerCase;
      // The config allows the user to override the completion state.
      switch (completionData.status) {
        case COMPLETION_STATE.COMPLETED:
        case COMPLETION_STATE.PASSED: {
          if (!config._reporting._onTrackingCriteriaMet) {
            Adapt.log.warn(`No value defined for '_onTrackingCriteriaMet', so defaulting to '${completionStatus}'`);
          } else {
            completionStatus = config._reporting._onTrackingCriteriaMet;
          }

          break;
        }
        case COMPLETION_STATE.FAILED: {
          if (!config._reporting._onAssessmentFailure) {
            Adapt.log.warn(`No value defined for '_onAssessmentFailure', so defaulting to '${completionStatus}'`);
          } else {
            completionStatus = config._reporting._onAssessmentFailure;
          }
        }
      }
      Adapt.offlineStorage.set('status', completionStatus);
    }

    endSession() {
      if (!this.scorm.finishCalled) {
        this.scorm.finish();
      }
      this.removeEventListeners();
    }

    removeEventListeners() {
      $(window).off('beforeunload unload', this.endSession);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.stopListening();
    }

  }

  return StatefulSession;

});
