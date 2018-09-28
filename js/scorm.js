define([
    'libraries/SCORM_API_wrapper',
	'libraries/aiccLMS', // AICC addition
	'libraries/aiccAPI', // e-lfh aicc
 	'./scorm/wrapper',
	'./scorm/logger'	
], function(API, aiccLMS, aiccAPI, wrapper, logger) {


    //Load and prepare SCORM API

    return wrapper.getInstance();

});