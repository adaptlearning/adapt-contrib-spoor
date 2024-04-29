import Adapt from 'core/js/adapt';
import Data from 'core/js/data';
import Wait from 'core/js/wait';
import Notify from 'core/js/notify';
import COMPLETION_STATE from '../enums/completionStateEnum';
import SUCCESS_STATE from '../enums/successStateEnum';
import pipwerks from 'libraries/SCORM_API_wrapper';
import Logger from './logger';
import ScormError from './error';
import Connection from './Connection';
import router from 'core/js/router';

const {
  CLIENT_COULD_NOT_CONNECT,
  SERVER_STATUS_UNSUPPORTED,
  CLIENT_STATUS_UNSUPPORTED,
  CLIENT_COULD_NOT_COMMIT,
  CLIENT_NOT_CONNECTED,
  CLIENT_COULD_NOT_FINISH,
  CLIENT_COULD_NOT_GET_PROPERTY,
  CLIENT_COULD_NOT_SET_PROPERTY,
  CLIENT_INVALID_CHOICE_VALUE
} = ScormError;

/**
 * IMPORTANT: This wrapper uses the Pipwerks SCORM wrapper and should therefore support both SCORM 1.2 and 2004. Ensure any changes support both versions.
 */
class ScormWrapper {

  constructor() {
    /* configuration */
    this.setCompletedWhenFailed = true;// this only applies to SCORM 2004
    /**
     * whether to commit each time there's a change to lesson_status or not
     */
    this.commitOnStatusChange = true;
    /**
     * whether to commit each time there's a change to any value
     */
    this.commitOnAnyChange = false;
    /**
     * how frequently (in minutes) to commit automatically. set to 0 to disable.
     */
    this.timedCommitFrequency = 10;
    /**
     * how many times to retry if a commit fails
     */
    this.maxCommitRetries = 5;
    /**
     * time (in milliseconds) to wait between retries
     */
    this.commitRetryDelay = 1000;

    /**
     * prevents commit from being called if there's already a 'commit retry' pending.
     */
    this.commitRetryPending = false;
    /**
     * how many times we've done a 'commit retry'
     */
    this.commitRetries = 0;
    /**
     * not currently used - but you could include in an error message to show when data was last saved
     */
    this.lastCommitSuccessTime = null;
    /**
     * The exit state to use when course isn't completed yet
     */
    this.exitStateIfIncomplete = 'auto';
    /**
     * The exit state to use when the course has been completed/passed
     */
    this.exitStateIfComplete = 'auto';

    this.timedCommitIntervalID = null;
    this.retryCommitTimeoutID = null;
    this.logOutputWin = null;
    this.startTime = null;
    this.endTime = null;
    this.lmsConnected = false;
    this.finishCalled = false;
    this.logger = Logger.getInstance();
    this.scorm = pipwerks.SCORM;
    this.maxCharLimitOverride = null;
    /**
     * Prevent the Pipwerks SCORM API wrapper's handling of the exit status
     */
    this.scorm.handleExitMode = false;

    this.suppressErrors = false;
    this.commit = this.commit.bind(this);
    this.doRetryCommit = this.doRetryCommit.bind(this);
    this.debouncedCommit = _.debounce(this.commit, 100);
    if (window.__debug) this.showDebugWindow();
    this._connection = null;

    if (!(window.API?.__offlineAPIWrapper && window?.API_1484_11?.__offlineAPIWrapper)) return;
    this.logger.error('Offline SCORM API is being used. No data will be reported to the LMS!');
  }

  // ******************************* public methods *******************************

  static getInstance() {
    if (ScormWrapper.instance === null) {
      ScormWrapper.instance = new ScormWrapper();
    }

    return ScormWrapper.instance;
  }

  getVersion() {
    return this.scorm.version;
  }

  setVersion(value) {
    this.logger.debug(`ScormWrapper::setVersion: ${value}`);
    this.scorm.version = value;
  }

  initialize(settings) {
    if (settings) {
      if (settings._showDebugWindow) {
        this.showDebugWindow();
      }
      this.setVersion(settings._scormVersion || '1.2');
      if (_.isBoolean(settings._suppressErrors)) {
        this.suppressErrors = settings._suppressErrors;
      }
      if (_.isBoolean(settings._commitOnStatusChange)) {
        this.commitOnStatusChange = settings._commitOnStatusChange;
      }
      if (_.isBoolean(settings._commitOnAnyChange)) {
        this.commitOnAnyChange = settings._commitOnAnyChange;
      }
      if (_.isFinite(settings._timedCommitFrequency)) {
        this.timedCommitFrequency = settings._timedCommitFrequency;
      }
      if (_.isFinite(settings._maxCommitRetries)) {
        this.maxCommitRetries = settings._maxCommitRetries;
      }
      if (_.isFinite(settings._commitRetryDelay)) {
        this.commitRetryDelay = settings._commitRetryDelay;
      }
      if ('_exitStateIfIncomplete' in settings) {
        this.exitStateIfIncomplete = settings._exitStateIfIncomplete;
      }
      if ('_exitStateIfComplete' in settings) {
        this.exitStateIfComplete = settings._exitStateIfComplete;
      }
      if (_.isBoolean(settings._setCompletedWhenFailed)) {
        this.setCompletedWhenFailed = settings._setCompletedWhenFailed;
      }
      if (!_.isNaN(settings._maxCharLimitOverride) && settings._maxCharLimitOverride > 0) {
        this.maxCharLimitOverride = settings._maxCharLimitOverride;
      }
    }

    this.logger.debug('ScormWrapper::initialize');
    this.lmsConnected = this.scorm.init();

    if (!this.lmsConnected) {
      this.handleInitializeError();
      return this.lmsConnected;
    }

    if (settings?._connectionTest?._isEnabled !== false) {
      this._connection = new Connection(settings?._connectionTest, this);
    }

    this.startTime = new Date();
    this.initTimedCommit();
    return this.lmsConnected;
  }

  /**
   * allows you to check if this is the user's first ever 'session' of a SCO, even after the lesson_status has been set to 'incomplete'
   */
  isFirstSession() {
    return (this.getValue(this.isSCORM2004() ? 'cmi.entry' : 'cmi.core.entry') === 'ab-initio');
  }

  setIncomplete() {
    this.setValue(this.isSCORM2004() ? 'cmi.completion_status' : 'cmi.core.lesson_status', COMPLETION_STATE.INCOMPLETE.asLowerCase);
    if (this.commitOnStatusChange && !this.commitOnAnyChange) this.commit();
  }

  setCompleted() {
    this.setValue(this.isSCORM2004() ? 'cmi.completion_status' : 'cmi.core.lesson_status', COMPLETION_STATE.COMPLETED.asLowerCase);
    if (this.commitOnStatusChange && !this.commitOnAnyChange) this.commit();
  }

  setPassed() {
    if (this.isSCORM2004()) {
      this.setValue('cmi.completion_status', COMPLETION_STATE.COMPLETED.asLowerCase);
      this.setValue('cmi.success_status', SUCCESS_STATE.PASSED.asLowerCase);
    } else {
      this.setValue('cmi.core.lesson_status', SUCCESS_STATE.PASSED.asLowerCase);
    }
    if (this.commitOnStatusChange && !this.commitOnAnyChange) this.commit();
  }

  setFailed() {
    if (this.isSCORM2004()) {
      this.setValue('cmi.success_status', SUCCESS_STATE.FAILED.asLowerCase);
      if (this.setCompletedWhenFailed) this.setValue('cmi.completion_status', COMPLETION_STATE.COMPLETED.asLowerCase);
    } else {
      this.setValue('cmi.core.lesson_status', SUCCESS_STATE.FAILED.asLowerCase);
    }
    if (this.commitOnStatusChange && !this.commitOnAnyChange) this.commit();
  }

  getStatus() {
    const status = this.getValue(this.isSCORM2004() ? 'cmi.completion_status' : 'cmi.core.lesson_status');
    if (this.isValidCompletionStatus(status)) return status;
    this.handleDataError(new ScormError(SERVER_STATUS_UNSUPPORTED, { status }));
    return null;
  }

  setStatus(status) {
    switch (status.toLowerCase()) {
      case COMPLETION_STATE.INCOMPLETE.asLowerCase:
        this.setIncomplete();
        break;
      case COMPLETION_STATE.COMPLETED.asLowerCase:
        this.setCompleted();
        break;
      case SUCCESS_STATE.PASSED.asLowerCase:
        this.setPassed();
        break;
      case SUCCESS_STATE.FAILED.asLowerCase:
        this.setFailed();
        break;
      default:
        this.handleDataError(new ScormError(CLIENT_STATUS_UNSUPPORTED, { status }));
    }
  }

  getScore() {
    return this.getValue(this.isSCORM2004() ? 'cmi.score.raw' : 'cmi.core.score.raw');
  }

  setScore(score, minScore = 0, maxScore = 100, isPercentageBased = true) {
    const cmiPrefix = this.isSCORM2004() ? 'cmi' : 'cmi.core';
    this.recordScore(cmiPrefix, ...arguments);
  }

  getLessonLocation() {
    return this.getValue(this.isSCORM2004() ? 'cmi.location' : 'cmi.core.lesson_location');
  }

  setLessonLocation(location) {
    this.setValue(this.isSCORM2004() ? 'cmi.location' : 'cmi.core.lesson_location', location);
  }

  getSuspendData() {
    return this.getValue('cmi.suspend_data');
  }

  setSuspendData(data) {
    this.setValue('cmi.suspend_data', data);
  }

  getStudentName() {
    return this.getValue(this.isSCORM2004() ? 'cmi.learner_name' : 'cmi.core.student_name');
  }

  getStudentId() {
    return this.getValue(this.isSCORM2004() ? 'cmi.learner_id' : 'cmi.core.student_id');
  }

  setLanguage(lang) {
    if (this.isSCORM2004()) {
      this.setValue('cmi.learner_preference.language', lang);
      return;
    }
    this.setValueIfChildSupported('cmi.student_preference.language', lang);
  }

  commit() {
    this.logger.debug('ScormWrapper::commit');

    if (!this.lmsConnected) {
      this.handleConnectionError();
      return;
    }

    if (this.commitRetryPending) {
      this.logger.debug('ScormWrapper::commit: skipping this commit call as one is already pending.');
      return;
    }

    if (this.scorm.save()) {
      this.commitRetries = 0;
      this.lastCommitSuccessTime = new Date();
      // if success, test the connection as the API usually returns true regardless of the ability to persist the data
      if (this._connection) this._connection.test();
      Adapt.trigger('spoor:commit', this);
      return;
    }

    if (this.commitRetries < this.maxCommitRetries && !this.finishCalled) {
      this.commitRetries++;
      this.initRetryCommit();
      return;
    }

    const errorCode = this.scorm.debug.getCode();
    this.handleDataError(new ScormError(CLIENT_COULD_NOT_COMMIT, {
      errorCode,
      errorInfo: this.scorm.debug.getInfo(errorCode),
      diagnosticInfo: this.scorm.debug.getDiagnosticInfo(errorCode)
    }));
  }

  finish() {
    this.logger.debug('ScormWrapper::finish');

    if (!this.lmsConnected || this.finishCalled) {
      this.handleConnectionError();
      return;
    }

    this.finishCalled = true;

    if (this.timedCommitIntervalID !== null) {
      window.clearInterval(this.timedCommitIntervalID);
    }

    if (this.commitRetryPending) {
      window.clearTimeout(this.retryCommitTimeoutID);
      this.commitRetryPending = false;
    }

    if (this.logOutputWin && !this.logOutputWin.closed) {
      this.logOutputWin.close();
    }

    this.endTime = new Date();

    if (this.isSCORM2004()) {
      this.scorm.set('cmi.session_time', this.convertToSCORM2004Time(this.endTime.getTime() - this.startTime.getTime()));
      this.scorm.set('cmi.exit', this.getExitState());
    } else {
      this.scorm.set('cmi.core.session_time', this.convertToSCORM12Time(this.endTime.getTime() - this.startTime.getTime()));
      this.scorm.set('cmi.core.exit', this.getExitState());
    }

    if (this._connection) {
      this._connection.stop();
      this._connection = null;
    }

    // api no longer available from this point
    this.lmsConnected = false;
    if (this.scorm.quit()) return;
    const errorCode = this.scorm.debug.getCode();

    this.handleFinishError(new ScormError(CLIENT_COULD_NOT_FINISH, {
      errorCode,
      errorInfo: this.scorm.debug.getInfo(errorCode),
      diagnosticInfo: this.scorm.debug.getDiagnosticInfo(errorCode)
    }));
  }

  recordInteraction(id, response, correct, latency, type) {
    if (!this.isChildSupported('cmi.interactions.n.id') || !this.isSupported('cmi.interactions._count')) return;
    switch (type) {
      case 'choice':
        this.recordInteractionMultipleChoice(...arguments);
        break;
      case 'matching':
        this.recordInteractionMatching(...arguments);
        break;
      case 'numeric':
        this.isSCORM2004() ? this.recordInteractionScorm2004(...arguments) : this.recordInteractionScorm12(...arguments);
        break;
      case 'fill-in':
        this.recordInteractionFillIn(...arguments);
        break;
      default:
        console.error(`ScormWrapper.recordInteraction: unknown interaction type of '${type}' encountered...`);
    }
  }

  // ****************************** private methods ******************************

  getValue(property) {
    this.logger.debug(`ScormWrapper::getValue: _property=${property}`);
    if (this.finishCalled) {
      this.logger.debug('ScormWrapper::getValue: ignoring request as \'finish\' has been called');
      return;
    }
    if (!this.lmsConnected) {
      this.handleConnectionError();
      return;
    }
    const value = this.scorm.get(property);
    const errorCode = this.scorm.debug.getCode();
    switch (errorCode) {
      case 0:
        break;
      case 403:
        // 403 errors are common (and normal) when targetting SCORM 2004 - they are triggered on any
        // attempt to get the value of a data model element that hasn't yet been assigned a value.
        this.logger.warn('ScormWrapper::getValue: data model element not initialized');
        break;
      default:
        this.handleDataError(new ScormError(CLIENT_COULD_NOT_GET_PROPERTY, {
          property,
          errorCode,
          errorInfo: this.scorm.debug.getInfo(errorCode),
          diagnosticInfo: this.scorm.debug.getDiagnosticInfo(errorCode)
        }));
    }
    this.logger.debug(`ScormWrapper::getValue: returning ${value}`);
    return value + '';
  }

  setValue(property, value) {
    this.logger.debug(`ScormWrapper::setValue: _property=${property} _value=${value}`);
    if (this.finishCalled) {
      this.logger.debug('ScormWrapper::setValue: ignoring request as \'finish\' has been called');
      return;
    }
    if (!this.lmsConnected) {
      this.handleConnectionError();
      return;
    }
    const success = this.scorm.set(property, value);
    if (success) {
      // if success, test the connection as the API usually returns true regardless of the ability to persist the data
      this._connection?.testOnSetValue();
    } else {
      // Some LMSs have an annoying tendency to return false from a set call even when it actually worked fine.
      // So we should only throw an error if there was a valid error code...
      const errorCode = this.scorm.debug.getCode();
      if (errorCode !== 0) {
        this.handleDataError(new ScormError(CLIENT_COULD_NOT_SET_PROPERTY, {
          property,
          value,
          errorCode,
          errorInfo: this.scorm.debug.getInfo(errorCode),
          diagnosticInfo: this.scorm.debug.getDiagnosticInfo(errorCode)
        }));
        return success;
      }
      this.logger.warn('ScormWrapper::setValue: LMS reported that the \'set\' call failed but then said there was no error!');
    }
    if (this.commitOnAnyChange) this.debouncedCommit();
    return success;
  }

  setValueIfChildSupported(property, value) {
    if (!this.isChildSupported(property)) return;
    this.setValue(property, value);
  }

  /**
   * used for checking any data field that is not 'LMS Mandatory' to see whether the LMS we're running on supports it or not.
   * Note that the way this check is being performed means it wouldn't work for any element that is
   * 'write only', but so far we've not had a requirement to check for any optional elements that are.
   */
  isSupported(property) {
    this.logger.debug(`ScormWrapper::isSupported: _property=${property}`);
    if (this.finishCalled) {
      this.logger.debug('ScormWrapper::isSupported: ignoring request as \'finish\' has been called');
      return;
    }
    if (!this.lmsConnected) {
      this.handleConnectionError();
      return false;
    }
    this.scorm.get(property);
    const isSupported = !this.isUnsupportedLastError();
    if (!isSupported) this.logUnsupported(property);
    return isSupported;
  }

  isChildSupported(property) {
    if (property.includes('_children')) return this.isSupported(property);
    this.logger.debug(`ScormWrapper::isChildSupported: _property=${property}`);
    if (this.finishCalled) {
      this.logger.debug('ScormWrapper::isChildSupported: ignoring request as \'finish\' has been called');
      return;
    }
    if (!this.lmsConnected) {
      this.handleConnectionError();
      return false;
    }
    const paths = property.split('.');
    const element = paths.pop();
    // remove last path if contains indexes
    if (/^\d+$|^n$/.test(paths[paths.length - 1])) paths.pop();
    const parentPath = paths.join('.');
    const children = this.scorm.get(`${parentPath}._children`);
    const isSupported = !this.isUnsupportedLastError() && children.includes(element);
    if (!isSupported) this.logUnsupported(property);
    return isSupported;
  }

  isUnsupportedErrorCode(code) {
    return code === 401;
  }

  isUnsupportedLastError() {
    return this.isUnsupportedErrorCode(this.scorm.debug.getCode());
  }

  logUnsupported(property) {
    property = property.replace(/\d+/g, 'n');
    this.logger.info(`ScormWrapper::${property} not supported by this LMS...`);
  }

  initTimedCommit() {
    this.logger.debug('ScormWrapper::initTimedCommit');

    if (!this.commitOnAnyChange && this.timedCommitFrequency > 0) {
      const delay = this.timedCommitFrequency * (60 * 1000);
      this.timedCommitIntervalID = window.setInterval(this.commit, delay);
    }
  }

  initRetryCommit() {
    this.logger.debug(`ScormWrapper::initRetryCommit ${this.commitRetries} out of ${this.maxCommitRetries}`);

    this.commitRetryPending = true;// stop anything else from calling commit until this is done

    this.retryCommitTimeoutID = window.setTimeout(this.doRetryCommit, this.commitRetryDelay);
  }

  doRetryCommit() {
    this.logger.debug('ScormWrapper::doRetryCommit');

    this.commitRetryPending = false;

    this.commit();
  }

  async handleInitializeError() {
    if (!Data.isReady) await Data.whenReady();
    Adapt.trigger('tracking:initializeError');
    this.handleError(new ScormError(CLIENT_COULD_NOT_CONNECT));
  }

  async handleConnectionError(callback = null) {
    if (!Data.isReady) await Data.whenReady();
    Adapt.trigger('tracking:connectionError', callback);
    this.handleError(new ScormError(CLIENT_NOT_CONNECTED));
  }

  async handleDataError(error) {
    if (!Data.isReady) await Data.whenReady();
    if (!this.isUnsupportedErrorCode(error.data.errorCode)) Adapt.trigger('tracking:dataError');
    this.handleError(error);
  }

  async handleFinishError(error) {
    if (!Data.isReady) await Data.whenReady();
    Adapt.trigger('tracking:terminationError');
    this.handleError(error);
  }

  async handleError(error) {
    if (!Data.isReady) await Data.whenReady();
    if ('value' in error.data) {
      // because some browsers (e.g. Firefox) don't like displaying very long strings in the window.confirm dialog
      if (error.data.value.length && error.data.value.length > 80) error.data.value = error.data.value.slice(0, 80) + '...';
      // if the value being set is an empty string, ensure it displays in the error as ''
      if (error.data.value === '') error.data.value = '\'\'';
    }
    const config = Adapt.course.get('_spoor');
    const messages = Object.assign({}, ScormError.defaultMessages, config && config._messages);
    const message = Handlebars.compile(messages[error.name])(error.data);
    this.logger.error(message);
    if (this.isUnsupportedErrorCode(error.data.errorCode)) return;
    switch (error.name) {
      case CLIENT_COULD_NOT_CONNECT:
        // defer error to allow other plugins which may be handling errors to execute first
        _.defer(() => {
          // don't show if error notification already handled by other plugins
          if (!Notify.isOpen) {
            // prevent course load execution
            Wait.begin();
            router.hideLoading();
            Notify.popup({
              _isCancellable: false,
              title: messages.title,
              body: message
            });
          }
        });
    }
    if (!this.suppressErrors && (!this.logOutputWin || this.logOutputWin.closed) && confirm(`${messages.title}:\n\n${message}\n\n${messages.pressOk}`)) {
      this.showDebugWindow();
    }
  }

  recordScore(cmiPrefix, score, minScore = 0, maxScore = 100, isPercentageBased = true) {
    if (this.isSCORM2004()) {
      // range split into negative/positive ranges (rather than minScore-maxScore) depending on score
      const range = (score < 0) ? Math.abs(minScore) : maxScore;
      // `scaled` converted to -1-1 range to indicate negative/positive weighting now that negative values can be assigned to questions
      const scaledScore = score / range;
      this.setValue(`${cmiPrefix}.score.scaled`, parseFloat(scaledScore.toFixed(7)));
    } else if (isPercentageBased) {
      // convert values to 0-100 range
      // negative scores are capped to 0 due to SCORM 1.2 limitations
      score = (score < 0) ? 0 : Math.round((score / maxScore) * 100);
      minScore = 0;
      maxScore = 100;
    } else {
      const validate = (attribute, value) => {
        const isValid = value >= 0 && score <= 100;
        if (!isValid) this.logger.warn(`${attribute} must be between 0-100.`);
      };
      validate(`${cmiPrefix}.score.raw`, score);
      validate(`${cmiPrefix}.score.min`, minScore);
      validate(`${cmiPrefix}.score.max`, maxScore);
    }
    this.setValue(`${cmiPrefix}.score.raw`, score);
    this.setValueIfChildSupported(`${cmiPrefix}.score.min`, minScore);
    this.setValueIfChildSupported(`${cmiPrefix}.score.max`, maxScore);
  }

  getInteractionCount() {
    const count = this.getValue('cmi.interactions._count');
    return count === '' ? 0 : count;
  }

  recordInteractionScorm12(id, response, correct, latency, type) {
    id = id.trim();
    const cmiPrefix = `cmi.interactions.${this.getInteractionCount()}`;
    this.setValue(`${cmiPrefix}.id`, id);
    this.setValueIfChildSupported(`${cmiPrefix}.type`, type);
    this.setValueIfChildSupported(`${cmiPrefix}.student_response`, response);
    this.setValueIfChildSupported(`${cmiPrefix}.result`, correct ? 'correct' : 'wrong');
    if (latency !== null && latency !== undefined) this.setValueIfChildSupported(`${cmiPrefix}.latency`, this.convertToSCORM12Time(latency));
    this.setValueIfChildSupported(`${cmiPrefix}.time`, this.getCMITime());
  }

  recordInteractionScorm2004(id, response, correct, latency, type) {
    id = id.trim();
    const cmiPrefix = `cmi.interactions.${this.getInteractionCount()}`;
    this.setValue(`${cmiPrefix}.id`, id);
    this.setValue(`${cmiPrefix}.type`, type);
    this.setValue(`${cmiPrefix}.learner_response`, response);
    this.setValue(`${cmiPrefix}.result`, correct ? 'correct' : 'incorrect');
    if (latency !== null && latency !== undefined) this.setValue(`${cmiPrefix}.latency`, this.convertToSCORM2004Time(latency));
    this.setValue(`${cmiPrefix}.timestamp`, this.getISO8601Timestamp());
  }

  recordInteractionMultipleChoice(id, response, correct, latency, type) {
    if (this.isSCORM2004()) {
      response = response.replace(/,|#/g, '[,]');
    } else {
      response = response.replace(/#/g, ',');
      response = this.checkResponse(response, 'choice');
    }
    const scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;
    scormRecordInteraction.call(this, id, response, correct, latency, type);
  }

  recordInteractionMatching(id, response, correct, latency, type) {
    response = response.replace(/#/g, ',');
    if (this.isSCORM2004()) {
      response = response.replace(/,/g, '[,]').replace(/\./g, '[.]');
    } else {
      response = this.checkResponse(response, 'matching');
    }
    const scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;
    scormRecordInteraction.call(this, id, response, correct, latency, type);
  }

  recordInteractionFillIn(id, response, correct, latency, type) {
    let maxLength = this.isSCORM2004() ? 250 : 255;
    maxLength = this.maxCharLimitOverride ?? maxLength;
    if (response.length > maxLength) {
      response = response.substr(0, maxLength);
      this.logger.warn(`ScormWrapper::recordInteractionFillIn: response data for ${id} is longer than the maximum allowed length of ${maxLength} characters; data will be truncated to avoid an error.`);
    }
    const scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;
    scormRecordInteraction.call(this, id, response, correct, latency, type);
  }

  getObjectiveCount() {
    const count = this.getValue('cmi.objectives._count');
    return count === '' ? 0 : count;
  }

  hasObjectiveById(id) {
    const count = this.getObjectiveCount();
    for (let i = 0; i < count; i++) {
      const storedId = this.getValue(`cmi.objectives.${i}.id`);
      if (storedId === id) return true;
    }
    return false;
  }

  getObjectiveIndexById(id) {
    const count = this.getObjectiveCount();
    for (let i = 0; i < count; i++) {
      const storedId = this.getValue(`cmi.objectives.${i}.id`);
      if (storedId === id) return i;
    }
    return count;
  }

  recordObjectiveDescription(id, description) {
    if (!this.isSCORM2004() || !description) return;
    id = id.trim();
    const hasObjective = this.hasObjectiveById(id);
    const index = this.getObjectiveIndexById(id);
    const cmiPrefix = `cmi.objectives.${index}`;
    if (!hasObjective) this.setValue(`${cmiPrefix}.id`, id);
    this.setValue(`${cmiPrefix}.description`, description);
  }

  recordObjectiveScore(id, score, minScore = 0, maxScore = 100, isPercentageBased = true) {
    if (!this.isChildSupported('cmi.objectives.n.id') || !this.isSupported('cmi.objectives._count')) return;
    id = id.trim();
    const hasObjective = this.hasObjectiveById(id);
    const index = this.getObjectiveIndexById(id);
    const cmiPrefix = `cmi.objectives.${index}`;
    if (!hasObjective) this.setValue(`${cmiPrefix}.id`, id);
    this.recordScore(cmiPrefix, score, minScore, maxScore, isPercentageBased);
  }

  recordObjectiveStatus(id, completionStatus, successStatus = SUCCESS_STATE.UNKNOWN.asLowerCase) {
    if (!this.isChildSupported('cmi.objectives.n.id') || !this.isSupported('cmi.objectives._count')) return;
    if (!this.isValidCompletionStatus(completionStatus)) {
      this.handleDataError(new ScormError(CLIENT_STATUS_UNSUPPORTED, { completionStatus }));
      return;
    }
    if (this.isSCORM2004() && !this.isValidSuccessStatus(successStatus)) {
      this.handleDataError(new ScormError(CLIENT_STATUS_UNSUPPORTED, { successStatus }));
      return;
    }
    id = id.trim();
    const hasObjective = this.hasObjectiveById(id);
    const index = this.getObjectiveIndexById(id);
    const cmiPrefix = `cmi.objectives.${index}`;
    if (!hasObjective) this.setValue(`${cmiPrefix}.id`, id);
    if (this.isSCORM2004()) {
      this.setValue(`${cmiPrefix}.completion_status`, completionStatus);
      this.setValue(`${cmiPrefix}.success_status`, successStatus);
      return;
    }
    if (!this.isChildSupported(`${cmiPrefix}.status`)) return;
    if (completionStatus === COMPLETION_STATE.COMPLETED.asLowerCase && successStatus !== SUCCESS_STATE.UNKNOWN.asLowerCase) completionStatus = successStatus;
    this.setValue(`${cmiPrefix}.status`, completionStatus);
  }

  isValidCompletionStatus(status) {
    status = status.toLowerCase(); // workaround for some LMSs (e.g. Arena) not adhering to the all-lowercase rule
    if (this.isSCORM2004()) {
      switch (status) {
        case COMPLETION_STATE.UNKNOWN.asLowerCase:
        case COMPLETION_STATE.NOTATTEMPTED.asLowerCase:
        case COMPLETION_STATE.NOT_ATTEMPTED.asLowerCase: // mentioned in SCORM 2004 spec - mapped to 'not attempted'
        case COMPLETION_STATE.INCOMPLETE.asLowerCase:
        case COMPLETION_STATE.COMPLETED.asLowerCase:
          return true;
      }
    } else {
      switch (status) {
        case COMPLETION_STATE.NOTATTEMPTED.asLowerCase:
        case COMPLETION_STATE.BROWSED.asLowerCase:
        case COMPLETION_STATE.INCOMPLETE.asLowerCase:
        case COMPLETION_STATE.COMPLETED.asLowerCase:
        case SUCCESS_STATE.PASSED.asLowerCase:
        case SUCCESS_STATE.FAILED.asLowerCase:
          return true;
      }
    }
    return false;
  }

  isValidSuccessStatus(status) {
    status = status.toLowerCase(); // workaround for some LMSs (e.g. Arena) not adhering to the all-lowercase rule
    if (this.isSCORM2004()) {
      switch (status) {
        case SUCCESS_STATE.UNKNOWN.asLowerCase:
        case SUCCESS_STATE.PASSED.asLowerCase:
        case SUCCESS_STATE.FAILED.asLowerCase:
          return true;
      }
    }
    return false;
  }

  showDebugWindow() {

    if (this.logOutputWin && !this.logOutputWin.closed) {
      this.logOutputWin.close();
    }

    this.logOutputWin = window.open('log_output.html', 'Log', 'width=600,height=300,status=no,scrollbars=yes,resizable=yes,menubar=yes,toolbar=yes,location=yes,top=0,left=0');

    if (!this.logOutputWin) return;
    this.logOutputWin.focus();
  }

  convertToSCORM12Time(msConvert) {

    const msPerSec = 1000;
    const msPerMin = msPerSec * 60;
    const msPerHour = msPerMin * 60;

    const ms = msConvert % msPerSec;
    msConvert = msConvert - ms;

    let secs = msConvert % msPerMin;
    msConvert = msConvert - secs;
    secs = secs / msPerSec;

    let mins = msConvert % msPerHour;
    msConvert = msConvert - mins;
    mins = mins / msPerMin;

    const hrs = msConvert / msPerHour;

    if (hrs > 9999) {
      return '9999:99:99.99';
    }

    const str = [ this.padWithZeroes(hrs, 4), this.padWithZeroes(mins, 2), this.padWithZeroes(secs, 2) ].join(':');
    return (`${str}.${Math.floor(ms / 10)}`);
  }

  /**
   * Converts milliseconds into the SCORM 2004 data type 'timeinterval (second, 10,2)'
   * this will output something like 'P1DT3H5M0S' which indicates a period of time of 1 day, 3 hours and 5 minutes
   * or 'PT2M10.1S' which indicates a period of time of 2 minutes and 10.1 seconds
   */
  convertToSCORM2004Time(msConvert) {
    let csConvert = Math.floor(msConvert / 10);
    const csPerSec = 100;
    const csPerMin = csPerSec * 60;
    const csPerHour = csPerMin * 60;
    const csPerDay = csPerHour * 24;

    let days = Math.floor(csConvert / csPerDay);
    csConvert -= days * csPerDay;
    days = days ? days + 'D' : '';

    let hours = Math.floor(csConvert / csPerHour);
    csConvert -= hours * csPerHour;
    hours = hours ? hours + 'H' : '';

    let mins = Math.floor(csConvert / csPerMin);
    csConvert -= mins * csPerMin;
    mins = mins ? mins + 'M' : '';

    let secs = Math.floor(csConvert / csPerSec);
    csConvert -= secs * csPerSec;
    secs = secs || '0';

    let cs = csConvert;
    cs = cs ? '.' + cs : '';

    const seconds = secs + cs + 'S';

    const hms = [ hours, mins, seconds ].join('');

    return 'P' + days + 'T' + hms;
  }

  getCMITime() {

    const date = new Date();

    const hours = this.padWithZeroes(date.getHours(), 2);
    const min = this.padWithZeroes(date.getMinutes(), 2);
    const sec = this.padWithZeroes(date.getSeconds(), 2);

    return [ hours, min, sec ].join(':');
  }

  /**
   * returns the current date & time in the format YYYY-MM-DDTHH:mm:ss
   */
  getISO8601Timestamp() {
    const date = new Date().toISOString();
    return date.replace(/.\d\d\dZ/, ''); // Date.toISOString returns the date in the format YYYY-MM-DDTHH:mm:ss.sssZ so we need to drop the last bit to make it SCORM 2004 conformant
  }

  padWithZeroes(numToPad, padBy) {

    let len = padBy;

    while (--len) {
      numToPad = '0' + numToPad;
    }

    return numToPad.slice(-padBy);
  }

  isSCORM2004() {
    return this.scorm.version === '2004';
  }

  /**
   * SCORM 1.2 requires that the identifiers in cmi.interactions.n.student_response for choice and matching activities be a character from [0-9a-z].
   * When numeric identifiers are used this function attempts to map identifiers 10 to 35 to [a-z]. Resolves issues/1376.
   */
  checkResponse(response, responseType) {
    if (!response) return response;
    if (responseType !== 'choice' && responseType !== 'matching') return response;

    response = response.split(/,|#/);

    const self = this;

    if (responseType === 'choice') {
      response = response.map(checkIdentifier);
    } else {
      response = response.map(r => {
        const identifiers = r.split('.');
        return checkIdentifier(identifiers[0]) + '.' + checkIdentifier(identifiers[1]);
      });
    }

    function checkIdentifier(r) {
      // if [0-9] then ok
      if (r.length === 1 && r >= '0' && r <= '9') return r;

      // if [a-z] then ok
      if (r.length === 1 && r >= 'a' && r <= 'z') return r;

      // try to map integers 10-35 to [a-z]
      const i = parseInt(r);

      if (isNaN(i) || i < 10 || i > 35) {
        self.handleError(new ScormError(CLIENT_INVALID_CHOICE_VALUE));
      }

      return Number(i).toString(36); // 10 maps to 'a', 11 maps to 'b', ..., 35 maps to 'z'
    }

    return response.join(',');
  }

  getExitState() {
    const completionStatus = this.scorm.data.completionStatus;
    const isIncomplete = completionStatus === COMPLETION_STATE.INCOMPLETE.asLowerCase || completionStatus === COMPLETION_STATE.UNKNOWN.asLowerCase;
    const exitState = isIncomplete ? this.exitStateIfIncomplete : this.exitStateIfComplete;
    if (exitState !== 'auto') return exitState;
    if (this.isSCORM2004()) return (isIncomplete ? 'suspend' : 'normal');
    return '';
  }

}

// static
ScormWrapper.instance = null;

export default ScormWrapper;
