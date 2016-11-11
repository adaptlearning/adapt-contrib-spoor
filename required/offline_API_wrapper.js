//API that stores data to a cookie for LMS behaviour testing
function createResetButton(API) {
	$('body').append($('<style id="spoor-clear-button">.spoor-clear-button { position:fixed; right:0px; bottom:0px; } </style>'));
	var $button = $('<button class="spoor-clear-button">Reset</button>');
	$('body').append($button);
	$button.on("click", function() {
		if (API) API.LMSClear();
		alert("Status Reset");
		window.location.reload();
	});
}


var API = {
	
	__offlineAPIWrapper:true,

	LMSInitialize: function() {
		//if (window.ISCOOKIELMS !== false) createResetButton(this);
		if (!API.LMSFetch()) {
			this.data["cmi.core.lesson_status"] = "not attempted";
			this.data["cmi.suspend_data"] = "";
			this.data["cmi.core.student_name"] = "Test Student";
			this.data["cmi.interactions._count"] = 0;
			API.LMSStore(true);
		}
		return "true";
	},
	LMSFinish: function() {
		return "true";
	},
	LMSGetValue: function(key) {
		return this.data[key];
	},
	LMSSetValue: function(key, value) {
		var str = 'cmi.interactions.';

		this.data[key] = value;

		if (key.indexOf(str) != -1) {
			var map = [];
			var strLen = str.length;

			_.each(_.keys(this.data), function(key) {
				var index = key.indexOf(str);
				if (index != -1) map[key.substr(strLen, 1)] = true;
			});
			
			this.data["cmi.interactions._count"] = _.compact(map).length;
		}
		
		API.LMSStore();
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
	},
	LMSStore: function(force) {
		if (window.ISCOOKIELMS === false) return;
		if (!force && API.cookie("_spoor") === undefined) return;
		API.cookie("_spoor", JSON.stringify(this.data));
	},
	LMSFetch: function() {
		if (window.ISCOOKIELMS === false) {
			this.data = {};
			return;
		}
		this.data = API.cookie("_spoor");
		if (this.data === undefined) {
			this.data = {}
			return false;
		} else {
			this.data = JSON.parse(this.data);
			return true;
		}
	},
	LMSClear: function() {
		API.removeCookie("_spoor");
	}
};

var API_1484_11 = {

	__offlineAPIWrapper:true,

	Initialize: function() {
		//if (window.ISCOOKIELMS !== false) createResetButton(this);
		if (!API_1484_11.LMSFetch()) {
			this.data["cmi.completion_status"] = "not attempted";
			this.data["cmi.suspend_data"] = "";
			this.data["cmi.learner_name"] = "Test Student";
			this.data["cmi.interactions._count"] = 0;
			API_1484_11.LMSStore(true);
		}
		return "true";
	},
	Terminate: function() {
		return "true";
	},
	GetValue: function(key) {
		return this.data[key];
	},
	SetValue: function(key, value) {
		var str = 'cmi.interactions.';

		this.data[key] = value;

		if (key.indexOf(str) != -1) {
			var map = [];
			var strLen = str.length;

			_.each(_.keys(this.data), function(key) {
				var index = key.indexOf(str);
				if (index != -1) map[key.substr(strLen, 1)] = true;
			});
			
			this.data["cmi.interactions._count"] = _.compact(map).length;
		}

		API_1484_11.LMSStore();
		return "true";
	},
	Commit: function() {
		return "true";
	},
	GetLastError: function() {
		return 0;
	},
	GetErrorString: function() {
		return "Fake error string.";
	},
	GetDiagnostic: function() {
		return "Fake diagnostic information."
	},
	LMSStore: function(force) {
		if (window.ISCOOKIELMS === false) return;
		if (!force && API_1484_11.cookie("_spoor") === undefined) return;
		API_1484_11.cookie("_spoor", JSON.stringify(this.data));
	},
	LMSFetch: function() {
		if (window.ISCOOKIELMS === false) {
			this.data = {};
			return;
		}
		this.data = API_1484_11.cookie("_spoor");
		if (this.data === undefined) {
			this.data = {}
			return false;
		} else {
			this.data = JSON.parse(this.data);
			return true;
		}
	},
	LMSClear: function() {
		API_1484_11.removeCookie("_spoor");
	}
};

//Extend both APIs with the jquery.cookie code https://github.com/carhartl/jquery-cookie
(function () {

	var $;

	for (var i = 0, count = arguments.length; i < count; i++) {

		$ = arguments[i];

		$.extend = function() {
			var src, copyIsArray, copy, name, options, clone,
				target = arguments[0] || {},
				i = 1,
				length = arguments.length;

			// Handle case when target is a string or something (possible in deep copy)
			if ( typeof target !== "object" && typeof target != "function" ) {
				target = {};
			}

			// extend jQuery itself if only one argument is passed
			if ( i === length ) {
				target = this;
				i--;
			}

			for ( ; i < length; i++ ) {
				// Only deal with non-null/undefined values
				if ( (options = arguments[ i ]) != null ) {
					// Extend the base object
					for ( name in options ) {
						src = target[ name ];
						copy = options[ name ];

						// Prevent never-ending loop
						if ( target === copy ) {
							continue;
						}

						if ( copy !== undefined ) {
							target[ name ] = copy;
						}
					}
				}
			}

			// Return the modified object
			return target;
		};

		var pluses = /\+/g;

		function encode(s) {
			return config.raw ? s : encodeURIComponent(s);
		}

		function decode(s) {
			return config.raw ? s : decodeURIComponent(s);
		}

		function stringifyCookieValue(value) {
			return encode(config.json ? JSON.stringify(value) : String(value));
		}

		function parseCookieValue(s) {
			if (s.indexOf('"') === 0) {
				// This is a quoted cookie as according to RFC2068, unescape...
				s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
			}

			try {
				// Replace server-side written pluses with spaces.
				// If we can't decode the cookie, ignore it, it's unusable.
				// If we can't parse the cookie, ignore it, it's unusable.
				s = decodeURIComponent(s.replace(pluses, ' '));
				return config.json ? JSON.parse(s) : s;
			} catch(e) {}
		}

		function read(s, converter) {
			var value = config.raw ? s : parseCookieValue(s);
			return typeof converter == "function" ? converter(value) : value;
		}

		var config = $.cookie = function (key, value, options) {

			// Write

			if (arguments.length > 1 && typeof value != "function") {
				options = $.extend({}, config.defaults, options);

				if (typeof options.expires === 'number') {
					var days = options.expires, t = options.expires = new Date();
					t.setTime(+t + days * 864e+5);
				}

				return (document.cookie = [
					encode(key), '=', stringifyCookieValue(value),
					options.expires ? '; expires=' + options.expires.toUTCString() : '', // use expires attribute, max-age is not supported by IE
					options.path    ? '; path=' + options.path : '',
					options.domain  ? '; domain=' + options.domain : '',
					options.secure  ? '; secure' : ''
				].join(''));
			}

			// Read

			var result = key ? undefined : {};

			// To prevent the for loop in the first place assign an empty array
			// in case there are no cookies at all. Also prevents odd result when
			// calling $.cookie().
			var cookies = document.cookie ? document.cookie.split('; ') : [];

			for (var i = 0, l = cookies.length; i < l; i++) {
				var parts = cookies[i].split('=');
				var name = decode(parts.shift());
				var cookie = parts.join('=');

				if (key && key === name) {
					// If second argument (value) is a function it's a converter...
					result = read(cookie, value);
					break;
				}

				// Prevent storing a cookie that we couldn't decode.
				if (!key && (cookie = read(cookie)) !== undefined) {
					result[name] = cookie;
				}
			}

			return result;
		};

		config.defaults = {};

		$.removeCookie = function (key, options) {
			if ($.cookie(key) === undefined) {
				return false;
			}

			// Must not alter options, thus extending a fresh object...
			$.cookie(key, '', $.extend({}, options, { expires: -1 }));
			return !$.cookie(key);
		};
	}

})(API, API_1484_11);
