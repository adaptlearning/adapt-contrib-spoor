class ScormError {

  constructor(name, data = {}) {
    this.name = name;
    this.data = data;
  }

}

ScormError.CLIENT_COULD_NOT_CONNECT = 'CLIENT_COULD_NOT_CONNECT';
ScormError.SERVER_STATUS_UNSUPPORTED = 'SERVER_STATUS_UNSUPPORTED'; // status
ScormError.CLIENT_STATUS_UNSUPPORTED = 'CLIENT_STATUS_UNSUPPORTED'; // status
ScormError.CLIENT_COULD_NOT_COMMIT = 'CLIENT_COULD_NOT_COMMIT'; // errorCode, errorInfo, diagnosticInfo
ScormError.CLIENT_NOT_CONNECTED = 'CLIENT_NOT_CONNECTED';
ScormError.CLIENT_COULD_NOT_FINISH = 'CLIENT_COULD_NOT_FINISH'; // errorCode, errorInfo, diagnosticInfo
ScormError.CLIENT_COULD_NOT_GET_PROPERTY = 'CLIENT_COULD_NOT_GET_PROPERTY'; // property, errorCode, errorInfo, diagnosticInfo
ScormError.CLIENT_COULD_NOT_SET_PROPERTY = 'CLIENT_COULD_NOT_SET_PROPERTY'; // property, value, errorCode, errorInfo, diagnosticInfo
ScormError.CLIENT_INVALID_CHOICE_VALUE = 'CLIENT_INVALID_CHOICE_VALUE';

ScormError.defaultMessages = {
  title: 'An error has occurred',
  pressOk: 'Press \'OK\' to view detailed debug information to send to technical support.',
  CLIENT_COULD_NOT_CONNECT: 'The course could not connect to the Learning Management System',
  SERVER_STATUS_UNSUPPORTED: 'An invalid lesson status of \'{{{status}}}\' was received from Learning Management System',
  CLIENT_STATUS_UNSUPPORTED: 'The status \'{{{status}}}\' is not supported.',
  CLIENT_COULD_NOT_COMMIT: 'There was a problem saving data to the Learning Management System\n\nError: {{errorCode}} - {{{errorInfo}}}\nLMS Error Info: {{{diagnosticInfo}}}',
  CLIENT_NOT_CONNECTED: 'The course is not connected to the Learning Management System',
  CLIENT_COULD_NOT_FINISH: 'The course was unable to terminate the learning session\n\nError: {{errorCode}} - {{{errorInfo}}}\nLMS Error Info: {{{diagnosticInfo}}}',
  CLIENT_COULD_NOT_GET_PROPERTY: 'Unable to get the value of {{property}} from the Learning Management System\n\nError: {{errorCode}} - {{{errorInfo}}}\nLMS Error Info: {{{diagnosticInfo}}}',
  CLIENT_COULD_NOT_SET_PROPERTY: 'Unable to set {{property}} to: \'{{{value}}}\'\n\nError: {{errorCode}} - {{{errorInfo}}}\nLMS Error Info: {{{diagnosticInfo}}}',
  CLIENT_INVALID_CHOICE_VALUE: 'Numeric choice/matching response elements must use a value from 0 to 35 in SCORM 1.2'
};

export default ScormError;
