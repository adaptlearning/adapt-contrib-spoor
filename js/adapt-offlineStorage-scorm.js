define([
	'coreJS/adapt',
	'./scorm',
	'coreJS/offlineStorage'
], function(Adapt, scorm) {

	//SCORM handler for Adapt.offlineStorage interface.

	//Store to help handle posting and offline uniformity
	var temporaryStore = {};

	Adapt.offlineStorage.initialize({

		get: function(name) {
			if (name === undefined) {
				//If not connected return just temporary store.
				if (this.useTemporaryStore()) return temporaryStore;

				//Get all values as a combined object
				return _.extend(scorm.getCustomStates(), {
					location: scorm.getLessonLocation(),
					score: scorm.getScore(),
					status: scorm.getStatus(),
					student: scorm.getStudentName()
				});
			}

			//If not connected return just temporary store value.
			if (this.useTemporaryStore())  return temporaryStore[name];

			//Get by name
			switch (name.toLowerCase()) {
			case "location":
				return scorm.getLessonLocation();
			case "score":
				return scorm.getScore();
			case "status":
				return scorm.getStatus();
			case "student":
				return scorm.getStudentName();
			default:
				return scorm.getCustomState(name);
			}
		},

		set: function(name, value) {
			
			//Convert arguments to array and drop the 'name' parameter
			var args = [].slice.call(arguments, 1);

			if (typeof name == "object") {

				//Set all values one at a time by recalling with name+value pairs
				var obj = arguments[0];
				for (var k in obj) {
					Adapt.offlineStorage.set.apply( Adapt.offlineStorage, [ k, obj[k] ].concat( args ) );
				}
				return;
			}

			//Save all values in temporaryStore if not connected
			if (this.useTemporaryStore()) return temporaryStore[name] = value;

			//Set by name
			switch (name.toLowerCase()) {
			case "location":
				return scorm.setLessonLocation.apply(scorm, args );
			case "score":
				return scorm.setScore.apply(scorm, args );
			case "status":
				return scorm.setStatus.apply(scorm, args );
			case "student":
				return false;
			default:

				//Store only custom variables locally
				temporaryStore[name] = value;

				//Always post full complement of variables
				return scorm.setCustomStates(temporaryStore);
			}
		},
		
		useTemporaryStore: function() {
			var cfg = Adapt.config.get('_spoor');
			
			if (!scorm.lmsConnected || (cfg && cfg._isEnabled === false)) return true;
			return false;
		}
		
	});

});
