import Adapt from 'core/js/adapt';
import data from 'core/js/data';
import logging from 'core/js/logging';
import ScormWrapper from './scorm/wrapper';
import COMPLETION_STATE from 'core/js/enums/completionStateEnum';
import ComponentSerializer from './serializers/ComponentSerializer';
import SCORMSuspendData from './serializers/SCORMSuspendData';
import offlineStorage from 'core/js/offlineStorage';

export default class StatefulSession extends Backbone.Controller {

  initialize() {
    _.bindAll(this, 'beginSession', 'onVisibilityChange', 'endSession');
    this.debouncedSaveSession = _.debounce(this.saveSessionState.bind(this), 1);
    this.scorm = ScormWrapper.getInstance();
    this._trackingIdType = 'block';
    this._componentSerializer = null;
    this._shouldCompress = false;
    this._shouldStoreResponses = true;
    this._shouldStoreAttempts = false;
    this._shouldRecordInteractions = true;
    this.beginSession();
  }

  beginSession() {
    this.listenTo(Adapt, 'app:dataReady', this.restoreSession);
    this._trackingIdType = Adapt.build.get('trackingIdType') || 'block';
    // suppress SCORM errors if 'nolmserrors' is found in the querystring
    if (window.location.search.indexOf('nolmserrors') !== -1) {
      this.scorm.suppressErrors = true;
    }
    const config = Adapt.spoor.config;
    if (!config) return;
    const tracking = config._tracking;
    this._shouldStoreResponses = (tracking && tracking._shouldStoreResponses) || false;
    this._shouldStoreAttempts = (tracking && tracking._shouldStoreAttempts) || false;
    this._shouldCompress = (tracking && tracking._shouldCompress) || false;
    this._componentSerializer = new ComponentSerializer(this._trackingIdType, this._shouldCompress);
    // Default should be to record interactions, so only avoid doing that if
    // _shouldRecordInteractions is set to false
    if (tracking?._shouldRecordInteractions === false) {
      this._shouldRecordInteractions = false;
    }
    const settings = config._advancedSettings;
    if (!settings) {
      // force use of SCORM 1.2 by default - some LMSes (SABA/Kallidus for instance)
      // present both APIs to the SCO and, if given the choice, the pipwerks
      // code will automatically select the SCORM 2004 API - which can lead to
      // unexpected behaviour.
      this.scorm.setVersion('1.2');
      this.scorm.initialize();
      return;
    }
    if (settings._showDebugWindow) {
      this.scorm.showDebugWindow();
    }
    this.scorm.setVersion(settings._scormVersion || '1.2');
    if (_.isBoolean(settings._suppressErrors)) {
      this.scorm.suppressErrors = settings._suppressErrors;
    }
    if (_.isBoolean(settings._commitOnStatusChange)) {
      this.scorm.commitOnStatusChange = settings._commitOnStatusChange;
    }
    if (_.isBoolean(settings._commitOnAnyChange)) {
      this.scorm.commitOnAnyChange = settings._commitOnAnyChange;
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
    Object.assign(globals._learnerInfo, offlineStorage.get('learnerinfo'));
  }

  restoreSessionState() {
    const sessionPairs = offlineStorage.get();
    const hasNoPairs = !Object.keys(sessionPairs).length;
    if (hasNoPairs) return;
    if (sessionPairs.c) {
      const [ _isComplete, _isAssessmentPassed ] = SCORMSuspendData.deserialize(sessionPairs.c);
      Adapt.course.set({
        _isComplete,
        _isAssessmentPassed
      });
    }
    if (!sessionPairs.q) return;
    this._componentSerializer?.deserialize(sessionPairs.q);
  }

  setupEventListeners() {
    this.removeEventListeners();
    this.listenTo(Adapt.components, 'change:_isComplete', this.debouncedSaveSession);
    this.listenTo(Adapt.course, 'change:_isComplete', this.debouncedSaveSession);
    if (this._shouldStoreResponses) {
      this.listenTo(data, 'change:_isSubmitted change:_userAnswer', this.debouncedSaveSession);
    }
    this.listenTo(Adapt, {
      'app:dataReady': this.restoreSession,
      'app:languageChanged': this.onLanguageChanged,
      'questionView:recordInteraction': this.onQuestionRecordInteraction,
      'tracking:complete': this.onTrackingComplete
    });
    const config = Adapt.spoor.config;
    const advancedSettings = config._advancedSettings;
    const shouldCommitOnVisibilityChange = (!advancedSettings ||
        advancedSettings._commitOnVisibilityChangeHidden !== false);
    if (shouldCommitOnVisibilityChange) {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    $(window).on('beforeunload unload', this.endSession);
  }

  async saveSessionState() {
    const isMidRender = !Adapt.parentView?.model.get('_isReady');
    // Wait until finished rendering to save
    if (isMidRender) return this.debouncedSaveSession();
    const courseState = SCORMSuspendData.serialize([
      Boolean(Adapt.course.get('_isComplete')),
      Boolean(Adapt.course.get('_isAssessmentPassed'))
    ]);
    const componentStates = await this._componentSerializer?.serialize(this._shouldStoreResponses, this._shouldStoreAttempts);
    const sessionPairs = {
      c: courseState,
      q: componentStates
    };
    offlineStorage.set(sessionPairs);
    this.printCompletionInformation(sessionPairs);
  }

  printCompletionInformation(suspendData) {
    if (typeof suspendData === 'string') {
      // In-case LMS data is passed as a string
      suspendData = JSON.parse(suspendData);
    }
    const courseState = SCORMSuspendData.deserialize(suspendData.c);
    const courseComplete = courseState[0];
    const assessmentPassed = courseState[1];
    const trackingIdModels = data.filter(model => model.get('_type') === this._trackingIdType && model.has('_trackingId'));
    const trackingIds = trackingIdModels.map(model => model.get('_trackingId'));
    if (!trackingIds.length) {
      logging.info(`course._isComplete: ${courseComplete}, course._isAssessmentPassed: ${assessmentPassed}, ${this._trackingIdType} completion: no tracking ids found`);
      return;
    }
    const completionData = SCORMSuspendData.deserialize(suspendData.q);
    const max = Math.max(...completionData.map(item => item[0][0]));
    const shouldStoreResponses = (completionData[0].length === 3);
    const completionString = completionData.reduce((markers, item) => {
      const trackingId = item[0][0];
      const isComplete = shouldStoreResponses ?
        item[2][1][0] :
        item[1][0];
      const mark = isComplete ? '1' : '0';
      markers[trackingId] = (markers[trackingId] === '-' || markers[trackingId] === '1') ?
        mark :
        '0';
      return markers;
    }, (new Array(max + 1).join('-').split(''))).join('');
    logging.info(`course._isComplete: ${courseComplete}, course._isAssessmentPassed: ${assessmentPassed}, ${this._trackingIdType} completion: ${completionString}`);
  }

  onLanguageChanged() {
    const config = Adapt.spoor.config;
    if (config?._reporting?._resetStatusOnLanguageChange !== true) return;
    offlineStorage.set('status', 'incomplete');
  }

  onVisibilityChange() {
    if (document.visibilityState === 'hidden') this.scorm.commit();
  }

  onQuestionRecordInteraction(questionView) {
    if (!this._shouldRecordInteractions) return;
    // View functions are deprecated: getResponseType, getResponse, isCorrect, getLatency
    const questionModel = questionView.model;
    const responseType = (questionModel.getResponseType ? questionModel.getResponseType() : questionView.getResponseType());
    // If responseType doesn't contain any data, assume that the question
    // component hasn't been set up for cmi.interaction tracking
    if (_.isEmpty(responseType)) return;
    const id = questionModel.get('_id');
    const response = (questionModel.getResponse ? questionModel.getResponse() : questionView.getResponse());
    const result = (questionModel.isCorrect ? questionModel.isCorrect() : questionView.isCorrect());
    const latency = (questionModel.getLatency ? questionModel.getLatency() : questionView.getLatency());
    offlineStorage.set('interaction', id, response, result, latency, responseType);
  }

  onTrackingComplete(completionData) {
    const config = Adapt.spoor.config;
    this.saveSessionState();
    let completionStatus = completionData.status.asLowerCase;
    // The config allows the user to override the completion state.
    switch (completionData.status) {
      case COMPLETION_STATE.COMPLETED:
      case COMPLETION_STATE.PASSED: {
        if (!config?._reporting?._onTrackingCriteriaMet) {
          logging.warn(`No value defined for '_onTrackingCriteriaMet', so defaulting to '${completionStatus}'`);
        } else {
          completionStatus = config._reporting._onTrackingCriteriaMet;
        }

        break;
      }
      case COMPLETION_STATE.FAILED: {
        if (!config?._reporting?._onAssessmentFailure) {
          logging.warn(`No value defined for '_onAssessmentFailure', so defaulting to '${completionStatus}'`);
        } else {
          completionStatus = config._reporting._onAssessmentFailure;
        }
      }
    }
    offlineStorage.set('status', completionStatus);
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
