define([
	'coreJS/adapt',
	'./scorm',
	'coreJS/offlineStorage'
], function(Adapt, scorm) {

	//SCORM handler for Adapt.offlineStorage interface.

	//Stores to help handle posting and offline uniformity
	var temporaryStore = {};
	var suspendDataStore = {};
	var suspendDataRestored = false;

	Adapt.offlineStorage.initialize({

		get: function(name) {
			if (name === undefined) {
				//If not connected return just temporary store.
				if (this.useTemporaryStore()) return temporaryStore;

				//Get all values as a combined object
				suspendDataStore = this.getCustomStates();

				var data = _.extend(_.clone(suspendDataStore), {
					location: scorm.getLessonLocation(),
					score: scorm.getScore(),
					status: scorm.getStatus(),
					student: scorm.getStudentName()
				});

				suspendDataRestored = true;
				
				return data;
			}

			//If not connected return just temporary store value.
			if (this.useTemporaryStore()) return temporaryStore[name];

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
					return this.getCustomState(name);
			}
		},

		set: function(name, value) {
			//Convert arguments to array and drop the 'name' parameter
			var args = [].slice.call(arguments, 1);
			var isObject = typeof name == "object";

			if (isObject) {
				value = name;
				name = "suspendData";
			}

			if (this.useTemporaryStore()) {
				if (isObject) {
					temporaryStore = _.extend(temporaryStore, value);
				} else {
					temporaryStore[name] = value;
				}

				return true;
			}

			switch (name.toLowerCase()) {
				case "interaction":
					return scorm.recordInteraction.apply(scorm, args);
				case "location":
					return scorm.setLessonLocation.apply(scorm, args);
				case "score":
					return scorm.setScore.apply(scorm, args);
				case "status":
					return scorm.setStatus.apply(scorm, args);
				case "student":
					return false;
				case "suspenddata":
				default:
					if (isObject) {
						suspendDataStore = _.extend(suspendDataStore, value);
					} else {
						suspendDataStore[name] = value;
					}

					var dataAsString = JSON.stringify(suspendDataStore);
					return (suspendDataRestored) ? scorm.setSuspendData(dataAsString) : false;
			}
		},

		getCustomStates: function() {
			var isSuspendDataStoreEmpty = _.isEmpty(suspendDataStore);
			if (!isSuspendDataStoreEmpty && suspendDataRestored) return _.clone(suspendDataStore);

			var dataAsString = scorm.getSuspendData();
			if (dataAsString === "" || dataAsString === " " || dataAsString === undefined) return {};

			var dataAsJSON = JSON.parse(dataAsString);
			if (!isSuspendDataStoreEmpty && !suspendDataRestored) dataAsJSON = _.extend(dataAsJSON, suspendDataStore);
			return dataAsJSON;
		},

		getCustomState: function(name) {
			var dataAsJSON = this.getCustomStates();
			return dataAsJSON[name];
		},
		
		useTemporaryStore: function() {
			var cfg = Adapt.config.get('_spoor');
			
			if (!scorm.lmsConnected || (cfg && cfg._isEnabled === false)) return true;
			return false;
		}
		
	});

});
