/*
* adapt-contrib-spoor
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Kevin Corry <kevinc@learningpool.com>, Oliver Foster <oliver.foster@kineo.com>
*/

define([
	'coreJS/adapt',
	'./scorm',
	'./adapt-stateful-session'
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

			this.startSCO();

			adaptStatefulSession.initialize();

			this.setupEventListeners();
		},

		checkConfig: function() {
			this._config = Adapt.config.get('_spoor');
			if (this._config && this._config._isEnabled !== false) return true;
			return false;
		},

		startSCO: function() {
			/**
			* force use of SCORM 1.2 - as some LMSes (SABA, for instance) present both APIs to the SCO and, if given the choice, 
			* the pipwerks code will automatically select the SCORM 2004 API - which can lead to unexpected behaviour.
			* this does obviously mean you'll have to manually change (or just remove) this next line if you want SCORM 2004 output
			*/
			//TODO allow version to be set via config.json
			scorm.setVersion("1.2");
			scorm.initialize()
		},	

		setupEventListeners: function() {
			this._onWindowUnload = _.bind(this.onWindowUnload, this);
			$(window).on('unload', this._onWindowUnload);
		},

	//Session End

		onWindowUnload: function() {
			this.endSCO();
			this.removeEventListeners();
		},

		endSCO: function() {			
			scorm.finish();
		},

		removeEventListeners: function() {
			$(window).off('unload', this._onWindowUnload);
		}
		
	}, Backbone.Events);

	Spoor.initialize();

});