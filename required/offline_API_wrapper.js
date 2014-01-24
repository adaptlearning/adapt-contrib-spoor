var API = {
	LMSInitialize: function() {
		return "true";
	},
	LMSFinish: function() {
		return "true";
	},
	LMSGetValue: function(key) {
		if(key === "cmi.core.lesson_status") {
			return "not attempted"
		}
		return "";
	},
	LMSSetValue: function() {
		return "true";
	},
	LMSCommit: function() {
		return "true";
	},
	LMSGetLastError: function() {
		return 0;
	},
	LMSGetErrorString: function() {
		return "Fake error string.";
	},
	LMSGetDiagnostic: function() {
		return "Fake diagnostic information."
	}
}