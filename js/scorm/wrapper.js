import Adapt from 'core/js/adapt';
import notify from 'core/js/notify';
import pipwerks from 'libraries/SCORM_API_wrapper';
import Logger from './logger';
import ScormError from './error';

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
    /**
     * Prevent the Pipwerks SCORM API wrapper's handling of the exit status
     */
    this.scorm.handleExitMode = false;

    this.suppressErrors = false;
    this.debouncedCommit = _.debounce(this.commit.bind(this), 100);
    if (window.__debug) {
      this.showDebugWindow();
    }

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

  initialize() {
    this.logger.debug('ScormWrapper::initialize');
    this.lmsConnected = this.scorm.init();

    if (!this.lmsConnected) {
      this.handleError(new ScormError(CLIENT_COULD_NOT_CONNECT));
      return this.lmsConnected;
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
    this.setValue(this.isSCORM2004() ? 'cmi.completion_status' : 'cmi.core.lesson_status', 'incomplete');

    if (this.commitOnStatusChange && !this.commitOnAnyChange) this.commit();
  }

  setCompleted() {
    this.setValue(this.isSCORM2004() ? 'cmi.completion_status' : 'cmi.core.lesson_status', 'completed');

    if (this.commitOnStatusChange && !this.commitOnAnyChange) this.commit();
  }

  setPassed() {
    if (this.isSCORM2004()) {
      this.setValue('cmi.completion_status', 'completed');
      this.setValue('cmi.success_status', 'passed');
    } else {
      this.setValue('cmi.core.lesson_status', 'passed');
    }

    if (this.commitOnStatusChange && !this.commitOnAnyChange) this.commit();
  }

  setFailed() {
    if (this.isSCORM2004()) {
      this.setValue('cmi.success_status', 'failed');

      if (this.setCompletedWhenFailed) {
        this.setValue('cmi.completion_status', 'completed');
      }
    } else {
      this.setValue('cmi.core.lesson_status', 'failed');
    }

    if (this.commitOnStatusChange && !this.commitOnAnyChange) this.commit();
  }

  getStatus() {
    const status = this.getValue(this.isSCORM2004() ? 'cmi.completion_status' : 'cmi.core.lesson_status');

    switch (status.toLowerCase()) { // workaround for some LMSes (e.g. Arena) not adhering to the all-lowercase rule
      case 'passed':
      case 'completed':
      case 'incomplete':
      case 'failed':
      case 'browsed':
      case 'not attempted':
      case 'not_attempted': // mentioned in SCORM 2004 docs but not sure it ever gets used
      case 'unknown': // the SCORM 2004 version of not attempted
        return status;
      default:
        this.handleError(new ScormError(SERVER_STATUS_UNSUPPORTED, { status }));
        return null;
    }
  }

  setStatus(status) {
    switch (status.toLowerCase()) {
      case 'incomplete':
        this.setIncomplete();
        break;
      case 'completed':
        this.setCompleted();
        break;
      case 'passed':
        this.setPassed();
        break;
      case 'failed':
        this.setFailed();
        break;
      default:
        this.handleError(new ScormError(CLIENT_STATUS_UNSUPPORTED, { status }));
    }
  }

  getScore() {
    return this.getValue(this.isSCORM2004() ? 'cmi.score.raw' : 'cmi.core.score.raw');
  }

  setScore(score, minScore = 0, maxScore = 100) {
    if (this.isSCORM2004()) {
      this.setValue('cmi.score.raw', score);
      this.setValue('cmi.score.min', minScore);
      this.setValue('cmi.score.max', maxScore);

      const range = maxScore - minScore;
      const scaledScore = ((score - minScore) / range).toFixed(7);
      this.setValue('cmi.score.scaled', scaledScore);
      return;
    }
    // SCORM 1.2
    this.setValue('cmi.core.score.raw', score);
    if (this.isSupported('cmi.core.score.min')) this.setValue('cmi.core.score.min', minScore);
    if (this.isSupported('cmi.core.score.max')) this.setValue('cmi.core.score.max', maxScore);
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
    if (!this.isSupported('cmi.student_preference.language')) return;
    this.setValue('cmi.student_preference.language', lang);
  }

  commit() {
    this.logger.debug('ScormWrapper::commit');

    if (!this.lmsConnected) {
      this.handleError(new ScormError(ScormError.CLIENT_NOT_CONNECTED));
      return;
    }

    if (this.commitRetryPending) {
      this.logger.debug('ScormWrapper::commit: skipping this commit call as one is already pending.');
      return;
    }

    if (this.scorm.save()) {
      this.commitRetries = 0;
      this.lastCommitSuccessTime = new Date();
      Adapt.trigger('spoor:commit', this);
      return;
    }

    if (this.commitRetries < this.maxCommitRetries && !this.finishCalled) {
      this.commitRetries++;
      this.initRetryCommit();
      return;
    }

    const errorCode = this.scorm.debug.getCode();
    this.handleError(new ScormError(CLIENT_COULD_NOT_COMMIT, {
      errorCode,
      errorInfo: this.scorm.debug.getInfo(errorCode),
      diagnosticInfo: this.scorm.debug.getDiagnosticInfo(errorCode)
    }));
  }

  finish() {
    this.logger.debug('ScormWrapper::finish');

    if (!this.lmsConnected || this.finishCalled) {
      this.handleError(new ScormError(CLIENT_NOT_CONNECTED));
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

    // api no longer available from this point
    this.lmsConnected = false;

    if (this.scorm.quit()) return;
    const errorCode = this.scorm.debug.getCode();
    this.handleError(new ScormError(CLIENT_COULD_NOT_FINISH, {
      errorCode,
      errorInfo: this.scorm.debug.getInfo(errorCode),
      diagnosticInfo: this.scorm.debug.getDiagnosticInfo(errorCode)
    }));
  }

  recordInteraction(id, response, correct, latency, type) {
    if (!this.isSupported('cmi.interactions._count')) {
      this.logger.info('ScormWrapper::recordInteraction: cmi.interactions are not supported by this LMS...');
      return;
    }

    switch (type) {
      case 'choice':
        this.recordInteractionMultipleChoice.apply(this, arguments);
        break;

      case 'matching':
        this.recordInteractionMatching.apply(this, arguments);
        break;

      case 'numeric':
        this.isSCORM2004() ? this.recordInteractionScorm2004.apply(this, arguments) : this.recordInteractionScorm12.apply(this, arguments);
        break;

      case 'fill-in':
        this.recordInteractionFillIn.apply(this, arguments);
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
      this.handleError(new ScormError(CLIENT_NOT_CONNECTED));
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
        this.handleError(new ScormError(CLIENT_COULD_NOT_GET_PROPERTY, {
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
      this.handleError(new ScormError(CLIENT_NOT_CONNECTED));
      return;
    }

    const success = this.scorm.set(property, value);
    if (!success) {
      // Some LMSes have an annoying tendency to return false from a set call even when it actually worked fine.
      // So we should only throw an error if there was a valid error code...
      const errorCode = this.scorm.debug.getCode();
      if (errorCode !== 0) {
        this.handleError(new ScormError(CLIENT_COULD_NOT_SET_PROPERTY, {
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
      this.handleError(new ScormError(CLIENT_NOT_CONNECTED));
      return false;
    }

    this.scorm.get(property);

    return (this.scorm.debug.getCode() !== 401); // 401 is the 'not implemented' error code
  }

  initTimedCommit() {
    this.logger.debug('ScormWrapper::initTimedCommit');

    if (!this.commitOnAnyChange && this.timedCommitFrequency > 0) {
      const delay = this.timedCommitFrequency * (60 * 1000);
      this.timedCommitIntervalID = window.setInterval(this.commit.bind(this), delay);
    }
  }

  initRetryCommit() {
    this.logger.debug(`ScormWrapper::initRetryCommit ${this.commitRetries} out of ${this.maxCommitRetries}`);

    this.commitRetryPending = true;// stop anything else from calling commit until this is done

    this.retryCommitTimeoutID = window.setTimeout(this.doRetryCommit.bind(this), this.commitRetryDelay);
  }

  doRetryCommit() {
    this.logger.debug('ScormWrapper::doRetryCommit');

    this.commitRetryPending = false;

    this.commit();
  }

  handleError(error) {

    if (!Adapt.get('_isStarted')) {
      Adapt.once('contentObjectView:ready', this.handleError.bind(this, error));
      return;
    }

    if ('value' in error.data) {
      // because some browsers (e.g. Firefox) don't like displaying very long strings in the window.confirm dialog
      if (error.data.value.length && error.data.value.length > 80) error.data.value = error.data.value.slice(0, 80) + '...';
      // if the value being set is an empty string, ensure it displays in the error as ''
      if (error.data.value === '') error.data.value = '\'\'';
    }

    const config = Adapt.course.get('_spoor');
    const messages = Object.assign({}, ScormError.defaultMessages, config && config._messages);
    const message = Handlebars.compile(messages[error.name])(error.data);

    switch (error.name) {
      case CLIENT_COULD_NOT_CONNECT:
        notify.popup({
          _isCancellable: false,
          title: messages.title,
          body: message
        });
        return;
    }

    this.logger.error(message);

    if (!this.suppressErrors && (!this.logOutputWin || this.logOutputWin.closed) && confirm(`${messages.title}:\n\n${message}\n\n${messages.pressOk}`)) {
      this.showDebugWindow();
    }

  }

  getInteractionCount() {
    const count = this.getValue('cmi.interactions._count');
    return count === '' ? 0 : count;
  }

  recordInteractionScorm12(id, response, correct, latency, type) {

    id = id.trim();

    const cmiPrefix = `cmi.interactions.${this.getInteractionCount()}`;

    this.setValue(`${cmiPrefix}.id`, id);
    this.setValue(`${cmiPrefix}.type`, type);
    this.setValue(`${cmiPrefix}.student_response`, response);
    this.setValue(`${cmiPrefix}.result`, correct ? 'correct' : 'wrong');
    if (latency !== null && latency !== undefined) this.setValue(`${cmiPrefix}.latency`, this.convertToSCORM12Time(latency));
    this.setValue(`${cmiPrefix}.time`, this.getCMITime());
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
      response = response.replace(/,/g, '[,]');
      response = response.replace(/\./g, '[.]');
    } else {
      response = this.checkResponse(response, 'matching');
    }

    const scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;

    scormRecordInteraction.call(this, id, response, correct, latency, type);
  }

  recordInteractionFillIn(id, response, correct, latency, type) {

    const maxLength = this.isSCORM2004() ? 250 : 255;

    if (response.length > maxLength) {
      response = response.substr(0, maxLength);

      this.logger.warn(`ScormWrapper::recordInteractionFillIn: response data for ${id} is longer than the maximum allowed length of ${maxLength} characters; data will be truncated to avoid an error.`);
    }

    const scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;

    scormRecordInteraction.call(this, id, response, correct, latency, type);
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
    const isIncomplete = completionStatus === 'incomplete' || completionStatus === 'not attempted';
    const exitState = isIncomplete ? this.exitStateIfIncomplete : this.exitStateIfComplete;

    if (exitState !== 'auto') return exitState;

    if (this.isSCORM2004()) return (isIncomplete ? 'suspend' : 'normal');

    return '';
  }

}

// static
ScormWrapper.instance = null;

export default ScormWrapper;
