/*
* adapt-contrib-spoor
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Kevin Corry <kevinc@learningpool.com>, Oliver Foster <oliver.foster@kineo.com>
*/

define([
	'coreJS/adapt',
	'./scorm',
	'./adapt-stateful-session',
	'./adapt-offlineStorage-scorm'
], function(Adapt, scorm, adaptStatefulSession) {

	//SCORM session manager

	var Spoor = _.extend({

		_config: null,

	//Session Begin

		initialize: function() {
			this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
		},

		onDataReady: function() {
			if (!this.checkConfig()) return;

			this.configureAdvancedSettings();

			scorm.initialize();

			adaptStatefulSession.initialize();

			this.setupEventListeners();
		},

		checkConfig: function() {
			this._config = Adapt.config.get('_spoor');
			if (this._config && this._config._isEnabled !== false) return true;
			return false;
		},

		configureAdvancedSettings: function() {
			if(this._config._advancedSettings) {
				var settings = this._config._advancedSettings;

				if(settings._showDebugWindow) scorm.showDebugWindow();

				scorm.setVersion(settings._scormVersion || "1.2");

				if(settings.hasOwnProperty("_commitOnStatusChange")) {
					scorm.commitOnStatusChange = settings._commitOnStatusChange;
				}

				if(settings.hasOwnProperty("_timedCommitFrequency")) {
					scorm.timedCommitFrequency = settings._timedCommitFrequency;
				}

				if(settings.hasOwnProperty("_maxCommitRetries")) {
					scorm.maxCommitRetries = settings._maxCommitRetries;
				}

				if(settings.hasOwnProperty("_commitRetryDelay")) {
					scorm.commitRetryDelay = settings._commitRetryDelay;
				}
				/**
				* Adapt doesn't yet support cmi.interactions, uncomment this when support is added
				if(settings.hasOwnProperty("_disableInteractionTracking")) {
					scorm.disableInteractionTracking = settings._disableInteractionTracking;
				}*/
			}
		},

		setupEventListeners: function() {
			this._onWindowUnload = _.bind(this.onWindowUnload, this);
			$(window).on('unload', this._onWindowUnload);
		},

	//Session End

		onWindowUnload: function() {
			scorm.finish();

			$(window).off('unload', this._onWindowUnload);
		}
		
	}, Backbone.Events);

	Spoor.initialize();

});