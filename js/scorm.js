define([
  'libraries/SCORM_API_wrapper',
  './scorm/wrapper',
  './scorm/logger'
], function(API, wrapper, logger) {

  //Load and prepare SCORM API

  return wrapper.getInstance();

});
