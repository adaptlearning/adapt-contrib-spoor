define ([
  'libraries/SCORM_API_wrapper'
], function(pipwerks) {

  /*
    IMPORTANT: This wrapper uses the Pipwerks SCORM wrapper and should therefore support both SCORM 1.2 and 2004. Ensure any changes support both versions.
  */

  var ScormWrapper = function() {
    /* configuration */
    this.setCompletedWhenFailed = true;// this only applies to SCORM 2004
    /**
     * whether to commit each time there's a change to lesson_status or not
     */
    this.commitOnStatusChange = true;
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
    this.exitStateIfIncomplete = "auto";
    /**
     * The exit state to use when the course has been completed/passed
     */
    this.exitStateIfComplete = "auto";


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

    if (window.__debug)
        this.showDebugWindow();

    if ((window.API && window.API.__offlineAPIWrapper) || (window.API_1484_11 && window.API_1484_11.__offlineAPIWrapper))
        this.logger.error("Offline SCORM API is being used. No data will be reported to the LMS!");
  };

  // static
  ScormWrapper.instance = null;

  /******************************* public methods *******************************/

  // static
  ScormWrapper.getInstance = function() {
    if (ScormWrapper.instance === null)
        ScormWrapper.instance = new ScormWrapper();

    return ScormWrapper.instance;
  };

  ScormWrapper.prototype.getVersion = function() {
    return this.scorm.version;
  };

  ScormWrapper.prototype.setVersion = function(value) {
    this.logger.debug("ScormWrapper::setVersion: " + value);
    this.scorm.version = value;
  };

  ScormWrapper.prototype.initialize = function() {
    this.logger.debug("ScormWrapper::initialize");
    this.lmsConnected = this.scorm.init();

    if (this.lmsConnected) {
      this.startTime = new Date();

      this.initTimedCommit();
    }
    else {
      this.handleError("Course could not connect to the LMS");
    }

    return this.lmsConnected;
  };

  /**
  * allows you to check if this is the user's first ever 'session' of a SCO, even after the lesson_status has been set to 'incomplete'
  */
  ScormWrapper.prototype.isFirstSession = function() {
    return (this.getValue(this.isSCORM2004() ? "cmi.entry" :"cmi.core.entry") === "ab-initio");
  };

  ScormWrapper.prototype.setIncomplete = function() {
    this.setValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status", "incomplete");

    if (this.commitOnStatusChange) this.commit();
  };

  ScormWrapper.prototype.setCompleted = function() {
    this.setValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status", "completed");

    if (this.commitOnStatusChange) this.commit();
  };

  ScormWrapper.prototype.setPassed = function() {
    if (this.isSCORM2004()) {
      this.setValue("cmi.completion_status", "completed");
      this.setValue("cmi.success_status", "passed");
    }
    else {
      this.setValue("cmi.core.lesson_status", "passed");
    }

    if (this.commitOnStatusChange) this.commit();
  };

  ScormWrapper.prototype.setFailed = function() {
    if (this.isSCORM2004()) {
      this.setValue("cmi.success_status", "failed");

      if (this.setCompletedWhenFailed) {
        this.setValue("cmi.completion_status", "completed");
      }
    }
    else {
      this.setValue("cmi.core.lesson_status", "failed");
    }

    if (this.commitOnStatusChange) this.commit();
  };

  ScormWrapper.prototype.getStatus = function() {
    var status = this.getValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status");

    switch(status.toLowerCase()) {// workaround for some LMSes (e.g. Arena) not adhering to the all-lowercase rule
      case "passed":
      case "completed":
      case "incomplete":
      case "failed":
      case "browsed":
      case "not attempted":
      case "not_attempted":// mentioned in SCORM 2004 docs but not sure it ever gets used
      case "unknown": //the SCORM 2004 version of not attempted
        return status;
      default:
        this.handleError("ScormWrapper::getStatus: invalid lesson status '" + status + "' received from LMS");
        return null;
    }
  };

  ScormWrapper.prototype.setStatus = function(status) {
    switch (status.toLowerCase()){
      case "incomplete":
        this.setIncomplete();
      break;
      case "completed":
        this.setCompleted();
      break;
      case "passed":
        this.setPassed();
      break;
      case "failed":
        this.setFailed();
      break;
      default:
        this.handleError("ScormWrapper::setStatus: the status '" + status + "' is not supported.");
    }
  };

  ScormWrapper.prototype.getScore = function() {
    return this.getValue(this.isSCORM2004() ? "cmi.score.raw" : "cmi.core.score.raw");
  };

  ScormWrapper.prototype.setScore = function(_score, _minScore, _maxScore) {
    if (this.isSCORM2004()) {
      this.setValue("cmi.score.raw", _score);
      this.setValue("cmi.score.min", _minScore);
      this.setValue("cmi.score.max", _maxScore);

      var range = _maxScore - _minScore;
      var scaledScore = ((_score - _minScore) / range).toFixed(7);
      this.setValue("cmi.score.scaled", scaledScore);
    }
    else {
      this.setValue("cmi.core.score.raw", _score);

      if (this.isSupported("cmi.core.score.min")) this.setValue("cmi.core.score.min", _minScore);

      if (this.isSupported("cmi.core.score.max")) this.setValue("cmi.core.score.max", _maxScore);
    }
  };

  ScormWrapper.prototype.getLessonLocation = function() {
    return this.getValue(this.isSCORM2004() ? "cmi.location" : "cmi.core.lesson_location");
  };

  ScormWrapper.prototype.setLessonLocation = function(_location) {
    this.setValue(this.isSCORM2004() ? "cmi.location" : "cmi.core.lesson_location", _location);
  };

  ScormWrapper.prototype.getSuspendData = function() {
    return this.getValue("cmi.suspend_data");
  };

  ScormWrapper.prototype.setSuspendData = function(_data) {
    this.setValue("cmi.suspend_data", _data);
  };

  ScormWrapper.prototype.getStudentName = function() {
    return this.getValue(this.isSCORM2004() ? "cmi.learner_name" : "cmi.core.student_name");
  };

  ScormWrapper.prototype.getStudentId = function(){
    return this.getValue(this.isSCORM2004() ? "cmi.learner_id":"cmi.core.student_id");
  };

  ScormWrapper.prototype.setLanguage = function(_lang){
    if (this.isSCORM2004()) {
      this.setValue("cmi.learner_preference.language", _lang);
    } else {
      if (this.isSupported("cmi.student_preference.language")) {
        this.setValue("cmi.student_preference.language", _lang);
      }
    }
  };

  ScormWrapper.prototype.commit = function() {
    this.logger.debug("ScormWrapper::commit");

    if (this.lmsConnected) {
      if (this.commitRetryPending) {
        this.logger.debug("ScormWrapper::commit: skipping this commit call as one is already pending.");
      }
      else {
        if (this.scorm.save()) {
          this.commitRetries = 0;
          this.lastCommitSuccessTime = new Date();
        }
        else {
          if (this.commitRetries < this.maxCommitRetries && !this.finishCalled) {
            this.commitRetries++;
            this.initRetryCommit();
          }
          else {
            var _errorCode = this.scorm.debug.getCode();

            var _errorMsg = "Course could not commit data to the LMS";
            _errorMsg += "\nError " + _errorCode + ": " + this.scorm.debug.getInfo(_errorCode);
            _errorMsg += "\nLMS Error Info: " + this.scorm.debug.getDiagnosticInfo(_errorCode);

            this.handleError(_errorMsg);
          }
        }
      }
    }
    else {
      this.handleError("Course is not connected to the LMS");
    }
  };

  ScormWrapper.prototype.finish = function() {
    this.logger.debug("ScormWrapper::finish");

    if (this.lmsConnected && !this.finishCalled) {
      this.finishCalled = true;

      if (this.timedCommitIntervalID !== null) {
        window.clearInterval(this.timedCommitIntervalID);
      }

      if(this.commitRetryPending) {
        window.clearTimeout(this.retryCommitTimeoutID);
        this.commitRetryPending = false;
      }

      if (this.logOutputWin && !this.logOutputWin.closed) {
        this.logOutputWin.close();
      }

      this.endTime = new Date();

      if (this.isSCORM2004()) {
        this.scorm.set("cmi.session_time", this.convertToSCORM2004Time(this.endTime.getTime() - this.startTime.getTime()));
        this.scorm.set("cmi.exit", this.getExitState());
      } else {
        this.scorm.set("cmi.core.session_time", this.convertToSCORM12Time(this.endTime.getTime() - this.startTime.getTime()));
        this.scorm.set("cmi.core.exit", this.getExitState());
      }

      // api no longer available from this point
      this.lmsConnected = false;

      if (!this.scorm.quit()) {
        this.handleError("Course could not finish");
      }
    }
    else {
      this.handleError("Course is not connected to the LMS");
    }
  };

  ScormWrapper.prototype.recordInteraction = function(id, response, correct, latency, type) {
    if(this.isSupported("cmi.interactions._count")) {
      switch(type) {
        case "choice":
          this.recordInteractionMultipleChoice.apply(this, arguments);
          break;

        case "matching":
          this.recordInteractionMatching.apply(this, arguments);
          break;

        case "numeric":
          this.isSCORM2004() ? this.recordInteractionScorm2004.apply(this, arguments) : this.recordInteractionScorm12.apply(this, arguments);
          break;

        case "fill-in":
          this.recordInteractionFillIn.apply(this, arguments);
          break;

        default:
          console.error("ScormWrapper.recordInteraction: unknown interaction type of '" + type + "' encountered...");
      }
    }
    else {
      this.logger.info("ScormWrapper::recordInteraction: cmi.interactions are not supported by this LMS...");
    }
  };

  /****************************** private methods ******************************/
  ScormWrapper.prototype.getValue = function(_property) {
    this.logger.debug("ScormWrapper::getValue: _property=" + _property);

    if (this.finishCalled) {
      this.logger.debug("ScormWrapper::getValue: ignoring request as 'finish' has been called");
      return;
    }

    if (this.lmsConnected) {
      var _value = this.scorm.get(_property);
      var _errorCode = this.scorm.debug.getCode();
      var _errorMsg = "";

      if (_errorCode !== 0) {
        if (_errorCode === 403) {
          this.logger.warn("ScormWrapper::getValue: data model element not initialized");
        }
        else {
          _errorMsg += "Course could not get " + _property;
          _errorMsg += "\nError Info: " + this.scorm.debug.getInfo(_errorCode);
          _errorMsg += "\nLMS Error Info: " + this.scorm.debug.getDiagnosticInfo(_errorCode);

          this.handleError(_errorMsg);
        }
      }
      this.logger.debug("ScormWrapper::getValue: returning " + _value);
      return _value + "";
    }
    else {
      this.handleError("Course is not connected to the LMS");
    }
  };

  ScormWrapper.prototype.setValue = function(_property, _value) {
    this.logger.debug("ScormWrapper::setValue: _property=" + _property + " _value=" + _value);

    if (this.finishCalled) {
      this.logger.debug("ScormWrapper::setValue: ignoring request as 'finish' has been called");
      return;
    }

    if (this.lmsConnected) {
      var _success = this.scorm.set(_property, _value);
      var _errorCode = this.scorm.debug.getCode();
      var _errorMsg = "";

      if (!_success) {
        /*
        * Some LMSes have an annoying tendency to return false from a set call even when it actually worked fine.
        * So, we should throw an error _only_ if there was a valid error code...
        */
        if(_errorCode !== 0) {
          _errorMsg += "Course could not set " + _property + " to " + _value;
          _errorMsg += "\nError Info: " + this.scorm.debug.getInfo(_errorCode);
          _errorMsg += "\nLMS Error Info: " + this.scorm.debug.getDiagnosticInfo(_errorCode);

          this.handleError(_errorMsg);
        }
        else {
          this.logger.warn("ScormWrapper::setValue: LMS reported that the 'set' call failed but then said there was no error!");
        }
      }

      return _success;
    }
    else {
      this.handleError("Course is not connected to the LMS");
    }
  };

  /**
  * used for checking any data field that is not 'LMS Mandatory' to see whether the LMS we're running on supports it or not.
  * Note that the way this check is being performed means it wouldn't work for any element that is
  * 'write only', but so far we've not had a requirement to check for any optional elements that are.
  */
  ScormWrapper.prototype.isSupported = function(_property) {
    this.logger.debug("ScormWrapper::isSupported: _property=" + _property);

    if (this.finishCalled) {
      this.logger.debug("ScormWrapper::isSupported: ignoring request as 'finish' has been called");
      return;
    }

    if (this.lmsConnected) {
      var _value = this.scorm.get(_property);
      var _errorCode = this.scorm.debug.getCode();

      return (_errorCode === 401 ? false : true);
    }
    else {
      this.handleError("Course is not connected to the LMS");
      return false;
    }
  };

  ScormWrapper.prototype.initTimedCommit = function() {
    this.logger.debug("ScormWrapper::initTimedCommit");

    if (this.timedCommitFrequency > 0) {
      var delay = this.timedCommitFrequency * (60 * 1000);
      this.timedCommitIntervalID = window.setInterval(this.commit.bind(this), delay);
    }
  };

  ScormWrapper.prototype.initRetryCommit = function() {
    this.logger.debug("ScormWrapper::initRetryCommit " + this.commitRetries + " out of " + this.maxCommitRetries);

    this.commitRetryPending = true;// stop anything else from calling commit until this is done

    this.retryCommitTimeoutID = window.setTimeout(this.doRetryCommit.bind(this), this.commitRetryDelay);
  };

  ScormWrapper.prototype.doRetryCommit = function() {
    this.logger.debug("ScormWrapper::doRetryCommit");

    this.commitRetryPending = false;

    this.commit();
  };

  ScormWrapper.prototype.handleError = function(_msg) {
    this.logger.error(_msg);

    if (!this.suppressErrors && (!this.logOutputWin || this.logOutputWin.closed) && confirm("An error has occured:\n\n" + _msg + "\n\nPress 'OK' to view debug information to send to technical support."))
        this.showDebugWindow();
  };

  ScormWrapper.prototype.getInteractionCount = function(){
    var count = this.getValue("cmi.interactions._count");
    return count === "" ? 0 : count;
  };

  ScormWrapper.prototype.recordInteractionScorm12 = function(id, response, correct, latency, type) {

    id = this.trim(id);

    var cmiPrefix = "cmi.interactions." + this.getInteractionCount();

    this.setValue(cmiPrefix + ".id", id);
    this.setValue(cmiPrefix + ".type", type);
    this.setValue(cmiPrefix + ".student_response", response);
    this.setValue(cmiPrefix + ".result", correct ? "correct" : "wrong");
    if (latency !== null && latency !== undefined) this.setValue(cmiPrefix + ".latency", this.convertToSCORM12Time(latency));
    this.setValue(cmiPrefix + ".time", this.getCMITime());
  };


  ScormWrapper.prototype.recordInteractionScorm2004 = function(id, response, correct, latency, type) {

    id = this.trim(id);

    var cmiPrefix = "cmi.interactions." + this.getInteractionCount();

    this.setValue(cmiPrefix + ".id", id);
    this.setValue(cmiPrefix + ".type", type);
    this.setValue(cmiPrefix + ".learner_response", response);
    this.setValue(cmiPrefix + ".result", correct ? "correct" : "incorrect");
    if (latency !== null && latency !== undefined) this.setValue(cmiPrefix + ".latency", this.convertToSCORM2004Time(latency));
    this.setValue(cmiPrefix + ".timestamp", this.getISO8601Timestamp());
  };


  ScormWrapper.prototype.recordInteractionMultipleChoice = function(id, response, correct, latency, type) {

    if (this.isSCORM2004()) {
      response = response.replace(/,|#/g, "[,]");
    } else {
      response = response.replace(/#/g, ",");
      response = this.checkResponse(response, 'choice');
    }

    var scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;

    scormRecordInteraction.call(this, id, response, correct, latency, type);
  };


  ScormWrapper.prototype.recordInteractionMatching = function(id, response, correct, latency, type) {

    response = response.replace(/#/g, ",");

    if(this.isSCORM2004()) {
      response = response.replace(/,/g, "[,]");
      response = response.replace(/\./g, "[.]");
    } else {
      response = this.checkResponse(response, 'matching');
    }

    var scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;

    scormRecordInteraction.call(this, id, response, correct, latency, type);
  };


  ScormWrapper.prototype.recordInteractionFillIn = function(id, response, correct, latency, type) {

    var maxLength = this.isSCORM2004() ? 250 : 255;

    if(response.length > maxLength) {
      response = response.substr(0, maxLength);

      this.logger.warn("ScormWrapper::recordInteractionFillIn: response data for " + id + " is longer than the maximum allowed length of " + maxLength + " characters; data will be truncated to avoid an error.");
    }

    var scormRecordInteraction = this.isSCORM2004() ? this.recordInteractionScorm2004 : this.recordInteractionScorm12;

    scormRecordInteraction.call(this, id, response, correct, latency, type);
  };

  ScormWrapper.prototype.showDebugWindow = function() {

    if (this.logOutputWin && !this.logOutputWin.closed) {
      this.logOutputWin.close();
    }

    this.logOutputWin = window.open("log_output.html", "Log", "width=600,height=300,status=no,scrollbars=yes,resizable=yes,menubar=yes,toolbar=yes,location=yes,top=0,left=0");

    if (this.logOutputWin)
        this.logOutputWin.focus();

    return;
  };

  ScormWrapper.prototype.convertToSCORM12Time = function(msConvert) {

    var msPerSec = 1000;
    var msPerMin = msPerSec * 60;
    var msPerHour = msPerMin * 60;

    var ms = msConvert % msPerSec;
    msConvert = msConvert - ms;

    var secs = msConvert % msPerMin;
    msConvert = msConvert - secs;
    secs = secs / msPerSec;

    var mins = msConvert % msPerHour;
    msConvert = msConvert - mins;
    mins = mins / msPerMin;

    var hrs = msConvert / msPerHour;

    if (hrs > 9999) {
      return "9999:99:99.99";
    }
    else {
      var str = [this.padWithZeroes(hrs,4), this.padWithZeroes(mins, 2), this.padWithZeroes(secs, 2)].join(":");
      return (str + '.' + Math.floor(ms/10));
    }
  };

  /**
  * Converts milliseconds into the SCORM 2004 data type 'timeinterval (second, 10,2)'
  * this will output something like 'P1DT3H5M0S' which indicates a period of time of 1 day, 3 hours and 5 minutes
  * or 'PT2M10.1S' which indicates a period of time of 2 minutes and 10.1 seconds
  */
  ScormWrapper.prototype.convertToSCORM2004Time = function(msConvert) {
    var csConvert = Math.floor(msConvert / 10);
    var csPerSec = 100;
    var csPerMin = csPerSec * 60;
    var csPerHour = csPerMin * 60;
    var csPerDay = csPerHour * 24;

    var days = Math.floor(csConvert/ csPerDay);
    csConvert -= days * csPerDay;
    days = days ? days + "D" : "";

    var hours = Math.floor(csConvert/ csPerHour);
    csConvert -= hours * csPerHour;
    hours = hours ? hours + "H" : "";

    var mins = Math.floor(csConvert/ csPerMin);
    csConvert -= mins * csPerMin;
    mins = mins ? mins + "M" : "";

    var secs = Math.floor(csConvert/ csPerSec);
    csConvert -= secs * csPerSec;
    secs = secs ? secs : "0";

    var cs = csConvert;
    cs = cs ? "." + cs : "";

    var seconds = secs + cs + "S";

    var hms = [hours,mins,seconds].join("");

    return "P" + days + "T" + hms;
  };

  ScormWrapper.prototype.getCMITime = function() {

    var date = new Date();

    var hours = this.padWithZeroes(date.getHours(),2);
    var min = this.padWithZeroes(date.getMinutes(),2);
    var sec = this.padWithZeroes(date.getSeconds(),2);

    return [hours, min, sec].join(":");
  };

  /**
  * returns the current date & time in the format YYYY-MM-DDTHH:mm:ss
  */
  ScormWrapper.prototype.getISO8601Timestamp = function() {
    var date = new Date().toISOString();
    return date.replace(/.\d\d\dZ/, "");//Date.toISOString returns the date in the format YYYY-MM-DDTHH:mm:ss.sssZ so we need to drop the last bit to make it SCORM 2004 conformant
  };

  ScormWrapper.prototype.padWithZeroes = function(numToPad, padBy) {

    var len = padBy;

    while(--len){ numToPad = "0" + numToPad; }

    return numToPad.slice(-padBy);
  };

  ScormWrapper.prototype.trim = function(str) {
    return str.replace(/^\s*|\s*$/g, "");
  };

  ScormWrapper.prototype.isSCORM2004 = function() {
    return this.scorm.version === "2004";
  };

  /*
  * SCORM 1.2 requires that the identifiers in cmi.interactions.n.student_response for choice and matching activities be a character from [0-9a-z].
  * When numeric identifiers are used this function attempts to map identifiers 10 to 35 to [a-z]. Resolves issues/1376.
  */
  ScormWrapper.prototype.checkResponse = function(response, responseType) {
    if (!response) return response;
    if (responseType != 'choice' && responseType != 'matching') return response;

    response = response.split(/,|#/);

    var self = this;

    if (responseType == 'choice') {
      response = response.map(checkIdentifier);
    } else {
      response = response.map(function(r) {
        var identifiers = r.split('.');
        return checkIdentifier(identifiers[0]) + '.' + checkIdentifier(identifiers[1]);
      });
    }

    function checkIdentifier(r) {
      var i;

      // if [0-9] then ok
      if (r.length == 1 && r >= '0' && r <= '9') return r;

      // if [a-z] then ok
      if (r.length == 1 && r >= 'a' && r <= 'z') return r;

      // try to map integers 10-35 to [a-z]
      i = parseInt(r);

      if (isNaN(i) || i < 10 || i > 35) {
        self.handleError('Numeric choice/matching response elements must use a value from 0 to 35 in SCORM 1.2');
      }

      return Number(i).toString(36); // 10 maps to 'a', 11 maps to 'b', ..., 35 maps to 'z'
    }

    return response.join(',');
  };

  ScormWrapper.prototype.getExitState = function() {
    var completionStatus = this.scorm.data.completionStatus;
    var isIncomplete = completionStatus === 'incomplete' || completionStatus === 'not attempted';
    var exitState = isIncomplete ? this.exitStateIfIncomplete : this.exitStateIfComplete;

    if (exitState !== 'auto') return exitState;

    if (this.isSCORM2004()) return (isIncomplete ? 'suspend' : 'normal');

    return '';
  };

  return ScormWrapper;

});
