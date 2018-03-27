define([
	'./scorm/API', // pipwerks scorm
	'./scorm/aiccLMS', // AICC addition
	'./scorm/aiccAPI', // e-lfh aicc
 	'./scorm/wrapper',
	'./scorm/logger'	
], function(API, aiccLMS, aiccAPI, wrapper, logger) {

	//Load and prepare SCORM API

	return wrapper.getInstance();

});