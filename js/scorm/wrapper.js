define (function(require) {

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
		
		this.timedCommitIntervalID = null;
		this.retryCommitTimeoutID = null;
		this.logOutputWin = null;
		this.startTime = null;
		this.endTime = null;
		
		this.lmsConnected = false;
		this.finishCalled = false;
		
		this.logger = Logger.getInstance();
		this.scorm = pipwerks.SCORM;

        	this.suppressErrors = false;
        
		if (window.__debug)
			this.showDebugWindow();
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
		this.scorm.version = value;
		/**
		 * stop the pipwerks code from setting cmi.core.exit to suspend/logout when targeting SCORM 1.2.
		 * there doesn't seem to be any tangible benefit to doing this in 1.2 and it can actually cause problems with some LMSes
		 * (e.g. setting it to 'logout' apparently causes Plateau to log the user completely out of the LMS!)
		 * It needs to be on for SCORM 2004 though, otherwise the LMS might not restore the suspend_data
		 */
		this.scorm.handleExitMode = this.isSCORM2004();
	};

	ScormWrapper.prototype.initialize = function() {
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

		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.setCompleted = function() {
		this.setValue(this.isSCORM2004() ? "cmi.completion_status" : "cmi.core.lesson_status", "completed");
		
		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.setPassed = function() {
		if (this.isSCORM2004()) {
			this.setValue("cmi.completion_status", "completed");
			this.setValue("cmi.success_status", "passed");
		}
		else {
			this.setValue("cmi.core.lesson_status", "passed");
		}

		if(this.commitOnStatusChange) this.commit();
	};

	ScormWrapper.prototype.setFailed = function() {
		if (this.isSCORM2004()) {
			this.setValue("cmi.success_status", "failed");
			
			if(this.setCompletedWhenFailed)
				this.setValue("cmi.completion_status", "completed");
		}
		else {
			this.setValue("cmi.core.lesson_status", "failed");
		}

			if(this.commitOnStatusChange) this.commit();
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
			case "unknown": //the SCORM 2004 version if not attempted
				return status;
			break;
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
          break;
      }
	}

	ScormWrapper.prototype.getScore = function() {
		return this.getValue(this.isSCORM2004() ? "cmi.score.raw" : "cmi.core.score.raw");
	};

	ScormWrapper.prototype.setScore = function(_score, _minScore, _maxScore) {
		if (this.isSCORM2004()) {
			this.setValue("cmi.score.raw", _score) && this.setValue("cmi.score.min", _minScore) && this.setValue("cmi.score.max", _maxScore) && this.setValue("cmi.score.scaled", _score / 100);
		}
		else {
			this.setValue("cmi.core.score.raw", _score);

			if(this.isSupported("cmi.core.score.min")) this.setValue("cmi.core.score.min", _minScore);

			if(this.isSupported("cmi.core.score.max")) this.setValue("cmi.core.score.max", _maxScore);
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
			
			if(this.timedCommitIntervalID != null) {
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
				this.scorm.set("cmi.session_time", this.convertMilliSecondsToSCORM2004Time(this.endTime.getTime() - this.startTime.getTime()));
			}
			else {
				this.scorm.set("cmi.core.session_time", this.convertMilliSecondsToSCORMTime(this.endTime.getTime() - this.startTime.getTime()));
				this.scorm.set("cmi.core.exit", "");
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

	ScormWrapper.prototype.recordInteraction = function(strID, strResponse, strCorrect, strLatency, scormInteractionType) {
		if(this.isSupported("cmi.interactions._count")) {
			switch(scormInteractionType) {
				case "choice":
					var responseIdentifiers = [];
					var answers = strResponse.split("#");
					
					for (var i = 0, count = answers.length; i < count; i++) {
						responseIdentifiers.push(new ResponseIdentifier(answers[i], answers[i]));
					}
					
					this.recordMultipleChoiceInteraction(strID, responseIdentifiers, strCorrect, null, null, null, strLatency, null);
				break;

				case "matching":
					var matchingResponses = [];
					var sourceTargetPairs = strResponse.split("#");
					var sourceTarget = null;
					
					for (var i = 0, count = sourceTargetPairs.length; i < count; i++) {
						sourceTarget = sourceTargetPairs[i].split(".");
						matchingResponses.push(new MatchingResponse(sourceTarget[0], sourceTarget[1]));
					}
					
					this.recordMatchingInteraction(strID, matchingResponses, strCorrect, null, null, null, strLatency, null);
				break;

				case "numeric":
					this.recordNumericInteraction(strID, strResponse, strCorrect, null, null, null, strLatency, null);
				break;

				case "fill-in":
					this.recordFillInInteraction(strID, strResponse, strCorrect, null, null, null, strLatency, null);
				break;

				default:
					console.error("ScormWrapper.recordInteraction: unknown interaction type of '" + scormInteractionType + "' encountered...");
			}
		}
		else {
			this.logger.info("ScormWrapper::recordInteraction: cmi.interactions are not supported by this LMS...");
		}
	}

	/****************************** private methods ******************************/
	ScormWrapper.prototype.getValue = function(_property) {
		this.logger.debug("ScormWrapper::getValue: _property=" + _property);

		if(this.finishCalled) {
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

		if(this.finishCalled)	{
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

		if(this.finishCalled) {
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
		
		if(this.timedCommitFrequency > 0) {
			var delay = this.timedCommitFrequency * (60 * 1000);
			this.timedCommitIntervalID = window.setInterval(_.bind(this.commit, this), delay);
		}
	};

	ScormWrapper.prototype.initRetryCommit = function() {
		this.logger.debug("ScormWrapper::initRetryCommit " + this.commitRetries + " out of " + this.maxCommitRetries);
		
		this.commitRetryPending = true;// stop anything else from calling commit until this is done
		
		this.retryCommitTimeoutID = window.setTimeout(_.bind(this.doRetryCommit, this), this.commitRetryDelay);
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

	ScormWrapper.prototype.createValidIdentifier = function(str)
	{
		str = this.trim(new String(str));

		if (_.indexOf(str.toLowerCase(), "urn:") === 0) {
			str = str.substr(4);
		}
		
		// URNs may only contain the following characters: letters, numbers - ( ) + . : = @ ; $ _ ! * ' %
		// if anything else is found, replace it with _
		str = str.replace(/[^\w\-\(\)\+\.\:\=\@\;\$\_\!\*\'\%]/g, "_");

		return str;
	};

	ScormWrapper.prototype.createResponseIdentifier = function(strShort, strLong) {
		
		if (strShort.length != 1 || strShort.search(/\w/) < 0) {
			strShort = "";
		}
		else {
			strShort = strShort.toLowerCase();
		}
		
		strLong = this.createValidIdentifier(strLong);
		
		return new ResponseIdentifier(strShort, strLong);
	};

	ScormWrapper.prototype.recordInteraction12 = function(strID, strResponse, bCorrect, strCorrectResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, scormInteractionType, strAlternateResponse, strAlternateCorrectResponse) {
		var bResult;
		var bTempResult;
		var interactionIndex;
		var strResult;
		
		// in SCORM 1.2, add a new interaction rather than updating an old one, because some LMS vendors have misinterpreted the "write only" rule regarding interactions to mean "write once"
		interactionIndex = this.getValue("cmi.interactions._count");
		
		if (interactionIndex === "") {
			interactionIndex = 0;
		}
		
		if (bCorrect === true || bCorrect === "true" || bCorrect === "correct") {
			strResult = "correct";
		}
		else if (bCorrect === false || bCorrect === "false" || bCorrect === "wrong") {
			strResult = "wrong";
		}
		else if (bCorrect === "unanticipated") {
			strResult = "unanticipated";
		}
		else if (bCorrect === "neutral") {
			strResult = "neutral";
		}

		var prefix = "cmi.interactions." + interactionIndex;
		
		bResult = this.setValue(prefix + ".id", strID);
		bResult = bResult && this.setValue(prefix + ".type", scormInteractionType);
		
		bTempResult = this.setValue(prefix + ".student_response", strResponse);
		
		if (bTempResult === false) {
			bTempResult = this.setValue(prefix + ".student_response", strAlternateResponse);
		}
		
		bResult = bResult && bTempResult;
		
		if (!_.isEmpty(strCorrectResponse)) {
			bTempResult = this.setValue(prefix + ".correct_responses.0.pattern", strCorrectResponse);
			if (bTempResult === false) {
				bTempResult = this.setValue(prefix + ".correct_responses.0.pattern", strAlternateCorrectResponse);
			}
			
			bResult = bResult && bTempResult;
		}

		if (!_.isEmpty(strResult)) {
			bResult = bResult && this.setValue(prefix + ".result", strResult);
		}
		
		// ignore the description parameter in SCORM 1.2, there is nothing we can do with it
		
		if (!_.isEmpty(intWeighting)) {
			bResult = bResult && this.setValue(prefix + ".weighting", intWeighting);
		}

		if (!_.isEmpty(intLatency)) {
			bResult = bResult && this.setValue(prefix + ".latency", this.convertMilliSecondsToSCORMTime(intLatency));
		}
		
		if (!_.isEmpty(strLearningObjectiveID)) {
			bResult = bResult && this.setValue(prefix + ".objectives.0.id", strLearningObjectiveID);
		}
		
		bResult = bResult && this.setValue(prefix + ".time", this.convertDateToCMITime(dtmTime));
		
		return bResult;
	};

	ScormWrapper.prototype.recordInteraction2004 = function(strID, strResponse, bCorrect, strCorrectResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, scormInteractionType) {	
		var bResult;
		var interactionIndex;
		var strResult;
		
		bCorrect = new String(bCorrect);
		
		interactionIndex = this.getValue("cmi.interactions._count");
		
		if (interactionIndex === "") {
			interactionIndex = 0;
		}
		
		if (bCorrect === true || bCorrect === "true" || bCorrect === "correct") {
			strResult = "correct";
		}
		else if (bCorrect === false || bCorrect == "false" || bCorrect === "wrong") {
			strResult = "incorrect";
		}
		else if (bCorrect === "unanticipated") {
			strResult = "unanticipated";
		}
		else if (bCorrect === "neutral") {
			strResult = "neutral";
		}
		else {
			strResult = "";
		}
		
		strID = this.createValidIdentifier(strID);

		var prefix = "cmi.interactions." + interactionIndex;
		
		bResult = this.setValue(prefix + ".id", strID);
		bResult = bResult && this.setValue(prefix + ".type", scormInteractionType);
		bResult = bResult && this.setValue(prefix + ".learner_response", strResponse);
		
		if (!_.isEmpty(strResult)) {
			bResult = bResult && this.setValue(prefix + ".result", strResult);
		}
		
		if (!_.isEmpty(strCorrectResponse)) {
			bResult = bResult && this.setValue(prefix + ".correct_responses.0.pattern", strCorrectResponse);
		}
		
		if (!_.isEmpty(strDescription)) {
			bResult = bResult && this.setValue(prefix + ".description", strDescription);
		}
		
		// ignore the description parameter in SCORM 1.2, there is nothing we can do with it
		
		if (!_.isEmpty(intWeighting)) {
			bResult = bResult && this.setValue(prefix + ".weighting", intWeighting);
		}

		if (!_.isEmpty(intLatency)) {
			bResult = bResult && this.setValue(prefix + ".latency", this.convertMilliSecondsToSCORM2004Time(intLatency));
		}
		
		if (!_.isEmpty(strLearningObjectiveID)) {
			bResult = bResult && this.setValue(prefix + ".objectives.0.id", strLearningObjectiveID);
		}
		
		bResult = bResult && this.setValue(prefix + ".timestamp", this.convertDateToISO8601Timestamp(dtmTime));
		
		return bResult;
	};

	ScormWrapper.prototype.recordMultipleChoiceInteraction = function(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID) {
		var _responseArray = null;
		var _correctResponseArray = null;
		
		if (response.constructor == String) {
			_responseArray = [this.createResponseIdentifier(response, response)];
		}
		else if (response.constructor == ResponseIdentifier) {
			_responseArray = [response];
		}
		else if (response.constructor == Array || response.constructor.toString().search("Array") > 0) {
			_responseArray = response;
		}
		else if (window.console && response.constructor.toString() == "(Internal Function)" && response.length > 0) {
			_responseArray = response;
		}
		else {
			this.handleError("ScormWrapper::recordMultipleChoiceInteraction: response is not in the correct format");
			return false;
		}
		
		if (!_.isEmpty(correctResponse)) {
			if (correctResponse.constructor == String) {
				_correctResponseArray = [this.createResponseIdentifier(correctResponse, correctResponse)];
			}
			else if (correctResponse.constructor == ResponseIdentifier) {
				_correctResponseArray = [correctResponse];
			}
			else if (correctResponse.constructor == Array || correctResponse.constructor.toString().search("Array") > 0) {
				_correctResponseArray = correctResponse;
			}
			else if (window.console && correctResponse.constructor.toString() == "(Internal Function)" && correctResponse.length > 0) {
				_correctResponseArray = correctResponse;
			}
			else {
				this.handleError("ScormWrapper::recordMultipleChoiceInteraction: correct response is not in the correct format");
				return false;
			}
		}
		else {
			_correctResponseArray = [];
		}
		
		var dtmTime = new Date();
		
		var strResponse = "";
		var strResponseLong = "";
		
		var strCorrectResponse = "";
		var strCorrectResponseLong = "";
		
		for (var i = 0; i < _responseArray.length; i++)	{
			if (strResponse.length > 0) {strResponse += this.isSCORM2004() ? "[,]" : ",";}
			if (strResponseLong.length > 0) {strResponseLong += ",";}
			
			strResponse += this.isSCORM2004() ? _responseArray[i].Long : _responseArray[i].Short;
			strResponseLong += _responseArray[i].Long;
		}

		for (var i = 0; i < _correctResponseArray.length; i++)	{
			if (strCorrectResponse.length > 0) {strCorrectResponse += this.isSCORM2004() ? "[,]" : ",";}
			if (strCorrectResponseLong.length > 0) {strCorrectResponseLong += ",";}
			
			strCorrectResponse += this.isSCORM2004() ? _correctResponseArray[i].Long : _correctResponseArray[i].Short;
			strCorrectResponseLong += _correctResponseArray[i].Long;
		}
		
		if (this.isSCORM2004())
			return this.recordInteraction2004(strID, strResponse, blnCorrect, strCorrectResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "choice");
		
		return this.recordInteraction12(strID, strResponseLong, blnCorrect, strCorrectResponseLong, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "choice",  strResponse, strCorrectResponse);
	};

	ScormWrapper.prototype.recordMatchingInteraction = function(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID) {
		var _responseArray = null;
		var _correctResponseArray = null;
		
		if (response.constructor == MatchingResponse) {
			_responseArray = [response];
		}
		else if (response.constructor == Array || response.constructor.toString().search("Array") > 0) {
			_responseArray = response;
		}
		else if (window.console && response.constructor.toString() == "(Internal Function)" && response.length > 0) {
			_responseArray = response;
		}
		else {
			this.handleError("ScormWrapper::recordMatchingInteraction: response is not in the correct format");
			return false;
		}
		
		if (!_.isEmpty(correctResponse)) {
			if (correctResponse.constructor == MatchingResponse) {
				_correctResponseArray = [correctResponse];
			}
			else if (correctResponse.constructor == Array || correctResponse.constructor.toString().search("Array") > 0) {
				_correctResponseArray = correctResponse;
			}
			else if (window.console && correctResponse.constructor.toString() == "(Internal Function)" && correctResponse.length > 0)	{
				_correctResponseArray = correctResponse;
			}
			else {
				this.handleError("ScormWrapper::recordMatchingInteraction: correct response is not in the correct format");
				return false;
			}
		}
		else {
			_correctResponseArray = [];
		}
		
		var dtmTime = new Date();
		
		var strResponse = "";
		var strResponseLong = "";
		
		var strCorrectResponse = "";
		var strCorrectResponseLong = "";
		
		for (var i = 0; i < _responseArray.length; i++) {
			if (strResponse.length > 0) {strResponse += ",";}
			if (strResponseLong.length > 0) {strResponseLong += this.isSCORM2004() ? "[,]" : ",";}
			
			strResponse += _responseArray[i].Source.Short + "." + _responseArray[i].Target.Short;
			strResponseLong += _responseArray[i].Source.Long + (this.isSCORM2004() ? "[.]" : ".") + _responseArray[i].Target.Long;
		}

		for (var i = 0; i < _correctResponseArray.length; i++) {
			if (strCorrectResponse.length > 0) {strCorrectResponse += ",";}
			if (strCorrectResponseLong.length > 0) {strCorrectResponseLong += this.isSCORM2004() ? "[,]" : ",";}
			
			strCorrectResponse += _correctResponseArray[i].Source.Short + "." + _correctResponseArray[i].Target.Short;
			strCorrectResponseLong += _correctResponseArray[i].Source.Long + (this.isSCORM2004() ? "[.]" : ".") + _correctResponseArray[i].Target.Long;
		}
		
		if (this.isSCORM2004())
			return this.recordInteraction2004(strID, strResponseLong, blnCorrect, strCorrectResponseLong, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "matching");
		
		return this.recordInteraction12(strID, strResponseLong, blnCorrect, strCorrectResponseLong, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "matching", strResponse, strCorrectResponse);
	};

	ScormWrapper.prototype.recordNumericInteraction = function(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID) {
		var dtmTime = new Date();

		if (this.isSCORM2004())
			return this.recordInteraction2004(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "numeric");
		
		return this.recordInteraction12(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "numeric", response, correctResponse);
	};

	ScormWrapper.prototype.recordFillInInteraction = function(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID) {
		var dtmTime = new Date();

		var max_len = this.isSCORM2004() ? 250 : 255;

		if(response.length > max_len) {
			response = response.substr(0,max_len);

			this.logger.warn("ScormWrapper::recordFillInInteraction: response data for " + strID + " is longer than the maximum allowed length of " + max_len + " characters; data will be truncated to avoid an error.");
		}

		if (this.isSCORM2004())
			return this.recordInteraction2004(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "fill-in");
		
		return this.recordInteraction12(strID, response, blnCorrect, correctResponse, strDescription, intWeighting, intLatency, strLearningObjectiveID, dtmTime, "fill-in", response, correctResponse);
	};

	ScormWrapper.prototype.showDebugWindow = function() {
		
		if (this.logOutputWin && !this.logOutputWin.closed) {
			this.logOutputWin.close();
		}
		
		this.logOutputWin = window.open("log_output.html", "Log", "width=600,height=300,status=no,scrollbars=yes,resize=yes,menubar=yes,toolbar=yes,location=yes,top=0,left=0");
		
		if (this.logOutputWin)
			this.logOutputWin.focus();
		
		return;
	};

	ScormWrapper.prototype.convertMilliSecondsToSCORMTime = function(value) {
		var h;
		var m;
		var s;
		var ms;
		var cs;
		var CMITimeSpan;
		
		ms = value % 1000;

		s = ((value - ms) / 1000) % 60;

		m = ((value - ms - (s * 1000)) / 60000) % 60;

		h = (value - ms - (s * 1000) - (m * 60000)) / 3600000;
		
		if (h === 10000)	{
			h = 9999;
			
			m = (value - (h * 3600000)) / 60000;
			if (m === 100)	{
				m = 99;
			}
			m = Math.floor(m);
			
			s = (value - (h * 3600000) - (m * 60000)) / 1000;
			if (s === 100)	{
				s = 99;
			}
			s = Math.floor(s);
			
			ms = (value - (h * 3600000) - (m * 60000) - (s * 1000));
		}

		cs = Math.floor(ms / 10);

		CMITimeSpan = this.zeroPad(h, 4) + ":" + this.zeroPad(m, 2) + ":" +	this.zeroPad(s, 2);
		CMITimeSpan += "." + cs;
		
		if (h > 9999) {
			CMITimeSpan = "9999:99:99";
			
			CMITimeSpan += ".99";
		}
		
		return CMITimeSpan;
	};

	ScormWrapper.prototype.convertDateToCMITime = function(_value) {
		var h;
		var m;
		var s;
		
		var dtmDate = new Date(_value);
		
		h = dtmDate.getHours();
		m = dtmDate.getMinutes();
		s = dtmDate.getSeconds();
		
		return this.zeroPad(h, 2) + ":" + this.zeroPad(m, 2) + ":" + this.zeroPad(s, 2);
	};

	ScormWrapper.prototype.convertMilliSecondsToSCORM2004Time = function(_value) {
		var str = "";
		var cs;
		var s;
		var m;
		var h;
		var d;
		var mo; // assumed to be an "average" month (a leap year every 4 years) = ((365*4) + 1) / 48 = 30.4375 days per month
		var y;
		
		var HUNDREDTHS_PER_SECOND = 100;
		var HUNDREDTHS_PER_MINUTE = HUNDREDTHS_PER_SECOND * 60;
		var HUNDREDTHS_PER_HOUR   = HUNDREDTHS_PER_MINUTE * 60;
		var HUNDREDTHS_PER_DAY    = HUNDREDTHS_PER_HOUR * 24;
		var HUNDREDTHS_PER_MONTH  = HUNDREDTHS_PER_DAY * (((365 * 4) + 1) / 48);
		var HUNDREDTHS_PER_YEAR   = HUNDREDTHS_PER_MONTH * 12;
		
		cs = Math.floor(_value / 10);
		
		y = Math.floor(cs / HUNDREDTHS_PER_YEAR);
		cs -= (y * HUNDREDTHS_PER_YEAR);
		
		mo = Math.floor(cs / HUNDREDTHS_PER_MONTH);
		cs -= (mo * HUNDREDTHS_PER_MONTH);
		
		d = Math.floor(cs / HUNDREDTHS_PER_DAY);
		cs -= (d * HUNDREDTHS_PER_DAY);
		
		h = Math.floor(cs / HUNDREDTHS_PER_HOUR);
		cs -= (h * HUNDREDTHS_PER_HOUR);
		
		m = Math.floor(cs / HUNDREDTHS_PER_MINUTE);
		cs -= (m * HUNDREDTHS_PER_MINUTE);
		
		s = Math.floor(cs / HUNDREDTHS_PER_SECOND);
		cs -= (s * HUNDREDTHS_PER_SECOND);
		
		if (y > 0)
			str += y + "Y";
		if (mo > 0)
			str += mo + "M";
		if (d > 0)
			str += d + "D";
		
		// check to see if we have any time before adding the "T"
		if ((cs + s + m + h) > 0 ) {
			
			str += "T";
			
			if (h > 0)
				str += h + "H";
			
			if (m > 0)
				str += m + "M";
			
			if ((cs + s) > 0) {
				str += s;
				
				if (cs > 0)
					str += "." + cs;
				
				str += "S";
			}
		}
		
		if (str === "")
			str = "0S";
		
		str = "P" + str;
		
		return str;
	};

	ScormWrapper.prototype.convertDateToISO8601Timestamp = function(_value) {
		var str;
		
		var dtm = new Date(_value);
		
		var y = dtm.getFullYear();
		var mo = dtm.getMonth() + 1;
		var d = dtm.getDate();
		var h = dtm.getHours();
		var m = dtm.getMinutes();
		var s = dtm.getSeconds();
		
		mo = this.zeroPad(mo, 2);
		d = this.zeroPad(d, 2);
		h = this.zeroPad(h, 2);
		m = this.zeroPad(m, 2);
		s = this.zeroPad(s, 2);
		
		str = y + "-" + mo + "-" + d + "T" + h + ":" + m + ":" + s;
		
		return str;
	};

	ScormWrapper.prototype.zeroPad = function(intNum, intNumDigits) {
		var strTemp;
		var intLen;
		var i;
		
		strTemp = new String(intNum);
		intLen = strTemp.length;
		
		if (intLen > intNumDigits) {
			strTemp = strTemp.substr(0, intNumDigits);
		}
		else {
			for (i = intLen; i < intNumDigits; i++)
				strTemp = "0" + strTemp;
		}
		
		return strTemp;
	};

	ScormWrapper.prototype.trim = function(str) {
		return str.replace(/^\s*|\s*$/g, "");
	};

	ScormWrapper.prototype.isSCORM2004 = function() {
		return this.scorm.version === "2004";
	};

	var MatchingResponse = function(source, target){
		if (source.constructor == String){
			source = ScormWrapper.getInstance().createResponseIdentifier(source, source);
		}

		if (target.constructor == String){
			target = ScormWrapper.getInstance().createResponseIdentifier(target, target);
		}
		
		this.Source = source;
		this.Target = target;
	};

	MatchingResponse.prototype.toString = function(){
		return "[Matching Response " + this.Source + ", " + this.Target + "]";
	};

	var ResponseIdentifier = function(strShort, strLong) {
		this.Short = new String(strShort);
		this.Long = new String(strLong);
	};

	ResponseIdentifier.prototype.toString = function() {
		return "[Response Identifier " + this.Short + ", " + this.Long + "]";
	};

	return ScormWrapper;
});
