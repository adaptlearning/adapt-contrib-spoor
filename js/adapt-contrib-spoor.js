define([
    'core/js/adapt',
    './scorm',
    './adapt-stateful-session',
    './adapt-offlineStorage-scorm'
], function(Adapt, scorm, adaptStatefulSession) {

    //SCORM session manager

    var Spoor = _.extend({

        _config: null,

    //Session Begin

        initialize: function() {
            this.listenToOnce(Adapt, "configModel:dataLoaded", this.onConfigLoaded);
            this.listenToOnce(Adapt, "app:dataReady", this.onDataReady);
        },

        onConfigLoaded: function() {
            if (!this.checkConfig()) {
                if (Adapt.offlineStorage.setReadyStatus) {// backwards-compatibility check - setReadyStatus was only introduced in framework v2.0.14
                    Adapt.offlineStorage.setReadyStatus();
                }
                return;
            }

            this.configureAdvancedSettings();

            scorm.initialize();

            /*
            force offlineStorage-scorm to initialise suspendDataStore - this allows us to do things like store the user's 
            chosen language before the rest of the course data loads 
            */
            Adapt.offlineStorage.get();

            if (Adapt.offlineStorage.setReadyStatus) {
                Adapt.offlineStorage.setReadyStatus();
            }

            this.setupEventListeners();
        },

        onDataReady: function() {
            adaptStatefulSession.initialize();
        },

        checkConfig: function() {
            this._config = Adapt.config.has('_spoor') ? Adapt.config.get('_spoor') : false;

            if (this._config && this._config._isEnabled !== false) return true;
            
            return false;
        },

        configureAdvancedSettings: function() {
            if(this._config._advancedSettings) {
                var settings = this._config._advancedSettings;

                if(settings._showDebugWindow) scorm.showDebugWindow();

                scorm.setVersion(settings._scormVersion || "1.2");

                if(settings.hasOwnProperty("_suppressErrors")) {
                    scorm.suppressErrors = settings._suppressErrors;
                }

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
            } else {
                /**
                * force use of SCORM 1.2 by default - some LMSes (SABA/Kallidus for instance) present both APIs to the SCO and, if given the choice,
                * the pipwerks code will automatically select the SCORM 2004 API - which can lead to unexpected behaviour.
                */
                scorm.setVersion("1.2");
            }

            /**
            * suppress SCORM errors if 'nolmserrors' is found in the querystring
            */
            if(window.location.search.indexOf('nolmserrors') != -1) scorm.suppressErrors = true;
        },

        setupEventListeners: function() {
            var advancedSettings = this._config._advancedSettings;
            var shouldCommitOnVisibilityChange = (!advancedSettings ||
                advancedSettings._commitOnVisibilityChangeHidden !== false) &&
                document.addEventListener;

            this._onWindowUnload = _.bind(this.onWindowUnload, this);
            $(window).on('unload', this._onWindowUnload);

            if (shouldCommitOnVisibilityChange) {
                document.addEventListener("visibilitychange", this.onVisibilityChange);
            }
        },

        onVisibilityChange: function() {
            if (document.visibilityState === "hidden") scorm.commit();
        },

    //Session End

        onWindowUnload: function() {
            scorm.finish();

            $(window).off('unload', this._onWindowUnload);
        }
        
    }, Backbone.Events);

    Spoor.initialize();

});
