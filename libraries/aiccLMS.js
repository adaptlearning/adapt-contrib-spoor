//*********************************************
// AICC LMS
// Created by Ian Robinson for e-Learning for Healthcare 2015
//*********************************************
//**
//** 30 July 2017   Ian Robinson  Class changed from e-LfH original to accomodate integration with the Adapt framwework and the file aicc-api.js which replaces the normal Adapt API.js file.
//**                              Added self.ExitValue property and assignment  to cmi.core.exit in LMSSetValue.
//**
//*********************************************
function AICC_LMS() {

    var self = this;

    self.Connected = false;

    self.Id = "";
    self.LmsUrl = "";
    self.Version = "4.0";
    self.LmsResponse = "";
    self.SuspendData = "";
    self.MasteryScore = 0;
    self.LessonLocation = "";
    self.LessonStatus = "";
    self.Score = 0;
    self.StudentId = 0;
    self.StudentName = "";
    self.TotalTime = 0;
    self.SessionTime = 0;
    self.EntryValue = "";
    self.ExitValue = "";
    self.LmsResponseError = 0;
    self.LmsResponseErrorText = "";

    self.Reset = function () {
        self.Id = "";
        self.LmsUrl = "";
        self.LmsResponse = "";
        self.EntryValue = "";
        self.ExitValue = "";
        self.SuspendData = "";
        self.MasteryScore = 0;
        self.LessonLocation = "";
        self.LessonStatus = "";
        self.Score = 0;
        self.StudentId = 0;
        self.StudentName = "";
        self.SessionTime = 0;
        self.TotalTime = 0;
    };

    self.LMSInitialize = function () {

        var result = false;

        try {

            var sSend = "command=GetParam&version=" + escape(self.Version) + "&session_id=" + escape(self.Id);

            $.ajax({
                method: "POST",
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                async: false,
                url: self.LmsUrl,
                data: sSend
            })
            .fail(function (jqXHR, textStatus) {

                throw { message: "Failed to initiate AICC LMS object. " + jqXHR.statusText };

            })
            .done(function (response) {

                // response from LMS, i.e. error_text=Successful if connected, student id, name, lesson location etc.
                self.ProcessResponse(response);

                // IR 06 July 2016 - added additional check for Rustici SCORM engine, which doesn't return 'successful' in the response error text, but
                // returns a zero error code only
                if (self.LmsResponseErrorText.toLowerCase() == "successful" || (self.LmsResponseErrorText.toLowerCase() == "" && self.LmsResponseError == 0))
                {
                    self.Connected = true;
                    result = true;

                }

            });

        }
        catch (e) {

            throw e;
        }

        return result;
    };

  self.ProcessResponse = function (sResponse) {

      const lines = sResponse.split("\n");
      const re = /^\[(\w+)\]$/m;
      let aiccSection = "none";

      for (let x in lines) {
        console.log("####"+lines[x]+"##");
        let line = lines[x];
        if (line.search(re) > -1) {                                 //single line section eg [Student_Data]
            console.log(line);
            console.log(line.replace(re,"$1"));
            aiccSection = line.replace(re,"$1").toLowerCase();      //set value for current aiccSeciton
            console.log("**"+aiccSection);
        } else if (line.search("=") > -1) {                         //key=value pair
          let elements = line.split("=");
          let key = elements[0].trim().toLowerCase();
          let value = elements[1].trim();

          if (value.length > 0) {
            console.log("+"+value+"+");
            if (value.search(re) > -1) {                            //value is in []s probably aicc_data=[Core]
              console.log("FOUND HIM");
              aiccSection = value.replace(re,"$1").toLowerCase(); //set value for current aiccSection
              console.log("**"+aiccSection);
            } else {
              switch (aiccSection) {
                case "none":                                    //opening section
                  if (key == "error") {
                    self.LmsResponseError = parseInt(value, 10);
                  } else if (key == "error_text") {
                    self.LmsResponseErrorText = value;
                  }
                  break;
                case "core":
                  if (key == "student_id") {
                    self.StudentId = value;
                  } else if (key == "student_name") {
                    self.StudentName = value;
                  } else if (key == "lesson_location") {
                    self.LessonLocation = value;
                  } else if (key == "lesson_status") {
                    // this contains a comma, then this field contains both the lesson_status and the core.entry value
                    // otherwise it contains on the lesson_status
                    if (value.indexOf(",") > -1) {
                      // split up lesson status and entry value
                      let temp = value.split(",");
                      self.LessonStatus = self.UnAbbreviateCompletionStatus(temp[0]);
                      self.EntryValue = self.UnAbbreviateEntry(temp[1]);
                    } else {
                      self.LessonStatus = self.UnAbbreviateCompletionStatus(value);
                    }
                  } else if (key == "score") {
                      if (value == "") {
                          self.Score = 0;
                      } else {
                          self.Score = parseInt(value, 10);
                      }
                  } else if (key == "time") {
                      self.TotalTime = parseFloat(value);
                  }
                  break;
                case "core_lesson":
                  if (key == "suspend_data") {
                    self.SuspendData = value;
                  }
                  break;
                case "student_data":
                  if (key == "mastery_score") {
                      self.MasteryScore = value;
                  }
                  break;
              }
            }
          }
        }
      }
    }

    self.UnAbbreviateEntry = function(s) {

        var entry = s.trim().toLowerCase();

        switch (entry) {
            case "a":
            case "ab":
                entry = "ab-initio";
                break;
            case "r":
                entry = "resume";
                break;
        }

        return entry;

    };

    self.UnAbbreviateCompletionStatus = function(s) {
        // not attempted
        // na
        // n

        var status = s.trim().toLowerCase();

        switch (status) {
            case "c":
                status = "completed";
                break;
            case "i":
                status = "incomplete";
                break;
            case "n":
            case "na":
                status = "not attempted";
                break;
            case "p":
                status = "passed";
                break;
            case "f":
                status = "failed";
                break;
            case "b":
                status = "browser";
                break;
        }

        return status;
    };

    self.PrepareData = function () {

        var sCRLF = String.fromCharCode(13,10);

        var sData = "";

        sData += "[CORE]" + sCRLF;
        sData += "Lesson_Location=" + self.LessonLocation + sCRLF;
        sData += "Lesson_Status=" + self.LessonStatus + "," + self.ExitValue + sCRLF;
        sData += "Score=" + self.Score + sCRLF;
        sData += "Time=" + self.SessionTime + sCRLF;
        //sData += "Exit=" + self.ExitValue + sCRLF;


        sData += "[CORE_LESSON]" + sCRLF;
        sData += "Suspend_Data=" + self.SuspendData + sCRLF;

        sData += "[OBJECTIVES_STATUS]" + sCRLF;

        return sData;

    };

    self.LMSFinish = function () {

        var result = false;

        try {
            var sAiccData = self.PrepareData();

            if (navigator.sendBeacon !== undefined) {

                var fd = new FormData();
                fd.append("command", "ExitParam"); // AICC command should be ExitAU but we have created a customised one for e-LfH
                fd.append("version", self.Version);
                fd.append("session_id", self.Id);
                fd.append("AICC_Data", sAiccData); // normal ExitAU command would not include an AICC_Data param.

                result = navigator.sendBeacon(self.LmsUrl, fd);

            } else {

                // make sure any outstanding data is saved (syncronous call)
                self.LMSCommit();

                // do another call to exit the AU now
                var exitData = "command=ExitAU&version=" + escape(self.Version) + "&session_id=" + escape(self.Id);

                $.ajax({ // send the exit / finish command to the LMS via the hub
                    method: "POST",
                    async: false,
                    url: self.LmsUrl,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data: exitData
                })
                .fail(function (jqXHR, textStatus) {
                    var error = new SCORM_Error(SCORM_Error_Enum.CONST_LMSFinish_ERROR, "Error disconnecting from AICC LMS: " + jqXHR.statusText);
                    alert(error.message);
                    throw error;
                })
                .done(function (response) {
                    self.Reset();
                    self.Connected = false;
                    result = true;
                });


            }

        }
        catch (e) {
            throw e;
        }

        return result;
    };

    self.LMSCommit = function () {

        var result = false;

        try
        {
            var sAiccData = self.PrepareData();
            var sSend = "command=PutParam&version=" + escape(self.Version) + "&session_id=" + escape(self.Id) + "&AICC_Data=" + escape(sAiccData);

            $.ajax({
                method: "POST",
                async: false,
                headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
            },
            url: self.LmsUrl,
            data: sSend
            })
            .fail(function(jqXHR, textStatus) {
                var error = new SCORM_Error(SCORM_Error_Enum.CONST_LMSCommit_ERROR, "Error saving data to AICC LMS: " + jqXHR.statusText);
                alert(error.message);
                throw error;
            })
            .done(function( response ) {

                self.LmsResponse = response;

                self.ProcessResponse(response);


                result = true;
            });

        }
        catch (e)
        {
            throw e;
        }

        return result;

    };

    self.LMSSetValue = function (key, value) {

        try {

            switch (key) {

                case "cmi.core.exit":
                    self.ExitValue = value;
                    break;

                case "cmi.core.lesson_location":
                    self.LessonLocation = value;
                    break;

                case "cmi.core.lesson_status":
                    self.LessonStatus = value;
                    break;

                case "cmi.student_data.mastery_score":
                    self.MasteryScore = value;
                    break;

                case "cmi.core.score.raw":
                    self.Score = value;
                    break;

                case "cmi.suspend_data":
                    self.SuspendData = value;
                    break;

                case "cmi.core.session_time":
                    self.SessionTime = value;
                    break;

                default: // for any other values, don't set anything
                    break;
            }

            return true;

        } catch (e) {
            // create custom error object contains this function's error code and
            // the LMS code and message
            var err = new SCORM_Error(SCORM_Error_Enum.CONST_LMSSetValue_ERROR, e.toString());
            throw err;
        }

        return false;
    };

    self.LMSGetValue = function (key) {

        try {

            switch (key) {
                /* Mandatory elements */
                case "cmi.core._children":

                    break;

                case "cmi.core.exit":
                    return self.ExitValue;
                    break;
                case "cmi.core.entry":
                    return self.EntryValue;
                    break;
                case "cmi.core.lesson_location":
                    return self.LessonLocation;
                    break;

                case "cmi.core.lesson_status":
                    return self.LessonStatus;
                    break;

                case "cmi.student_data.mastery_score":
                    return self.MasteryScore;
                    break;

                case "cmi.core.score.raw":
                    return self.Score;
                    break;

                case "cmi.core.student_id":
                    return self.StudentId;
                    break;

                case "cmi.core.student_name":
                    return self.StudentName
                    break;

                case "cmi.suspend_data":
                    return self.SuspendData;
                    break;

                case "cmi.core.total_time":
                    return self.TotalTime();
                    break;

                default: // no match
                    return "";
                    break;
            }

        } catch (e) {
            var err = new SCORM_Error(CONST_LMSGetValue_ERROR, e.toString());
            throw err;
        }

    };


    self.LMSGetLastError = function (parameter) {
        return self.LmsResponseError;
    };


    self.LMSGetErrorString = function (parameter) {

        return self.LmsResponseErrorText;
    };

    // used to return vendor specific error messages
    self.LMSGetDiagnostic = function(parameter) {
        return "";
    };
}
//*********************************************
// End of AICC LMS
//*********************************************

//*********************************************
// SCORM_Error definition
//*********************************************
function SCORM_Error(errorCode, errorMsg) {

    var self = this;

    self.Code = errorCode;
    self.Msg = errorMsg;
    self.LMSErrorCode = 0;
    self.LMSErrorMsg = "";
}

//*********************************************
// End of SCORM_Error definition
//*********************************************

var SCORM_Error_Enum = {
    CONST_LMSInitialise_ERROR: 100,
    CONST_LMSDisconnect_ERROR: 200,
    CONST_LMSSetValue_ERROR: 300,
    CONST_LMSGetValue_ERROR: 310,
    CONST_LMSCommit_ERROR: 400,
    CONST_LMSFinish_ERROR: 500,
    CONST_CoreSetSessionTime_ERROR: 600,
    CONST_CoreChildren_ERROR: 700,
    CONST_StudentDataChildren_ERROR: 800,
    CONST_Interactions_ERROR: 900
};
