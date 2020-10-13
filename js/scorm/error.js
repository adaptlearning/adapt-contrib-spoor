define(function() {

  class ScormError {

    constructor(name, data = {}) {
      this.name = name;
      this.data = data;
    }

  }

  ScormError.CLIENT_COULD_NOT_CONNECT = 'CLIENT_COULD_NOT_CONNECT';
  ScormError.SERVER_STATUS_UNSUPPORTED = 'SERVER_STATUS_UNSUPPORTED'; // status
  ScormError.CLIENT_STATUS_UNSUPPORTED = 'CLIENT_STATUS_UNSUPPORTED'; // status
  ScormError.CLIENT_COULD_NOT_COMMIT = 'CLIENT_COULD_NOT_COMMIT'; // code, info, diagnosticInfo
  ScormError.CLIENT_NOT_CONNECTED = 'CLIENT_NOT_CONNECTED';
  ScormError.CLIENT_COULD_NOT_FINISH = 'CLIENT_COULD_NOT_FINISH';
  ScormError.CLIENT_COULD_NOT_GET_PROPERTY = 'CLIENT_COULD_NOT_GET_PROPERTY'; // property, info, diagnosticInfo
  ScormError.CLIENT_COULD_NOT_SET_PROPERTY = 'CLIENT_COULD_NOT_SET_PROPERTY'; // property, value, info, diagnosticInfo
  ScormError.CLIENT_INVALID_CHOICE_VALUE = 'CLIENT_INVALID_CHOICE_VALUE'; // value

  ScormError.defaultMessages = {
    title: 'WARNING',
    CLIENT_COULD_NOT_CONNECT: 'Course could not connect to the LMS',
    SERVER_STATUS_UNSUPPORTED: `ScormWrapper::getStatus: invalid lesson status '{{status}}' received from LMS`,
    CLIENT_STATUS_UNSUPPORTED: `ScormWrapper::setStatus: the status '{{status}}' is not supported.`,
    CLIENT_COULD_NOT_COMMIT: 'Course could not commit data to the LMS\nError {{code}}: {{info}}\nLMS Error Info: {{diagnosticInfo}}',
    CLIENT_NOT_CONNECTED: 'Course is not connected to the LMS',
    CLIENT_COULD_NOT_FINISH: 'Course could not finish',
    CLIENT_COULD_NOT_GET_PROPERTY: 'Course could not get {{property}}\nError Info: {{info}}\nLMS Error Info: {{diagnosticInfo}}',
    CLIENT_COULD_NOT_SET_PROPERTY: 'Course could not set {{property}} to {{value}}\nError Info: {{info}}\nLMS Error Info: {{diagnosticInfo}}',
    CLIENT_INVALID_CHOICE_VALUE: 'Numeric choice/matching response elements must use a value from 0 to 35 in SCORM 1.2: {{value}}'
  };

  return ScormError;

});
