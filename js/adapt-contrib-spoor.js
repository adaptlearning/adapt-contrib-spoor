define([
  'core/js/adapt',
  './scorm/wrapper',
  './adapt-stateful-session',
  './adapt-offlineStorage-scorm'
], function(Adapt, ScormWrapper, StatefulSession, OfflineStorage) {

  class Spoor extends Backbone.Controller {

    initialize() {
      this.config = null;
      this.scorm = ScormWrapper.getInstance();
      this.listenToOnce(Adapt, 'offlineStorage:prepare', this._prepare);
    }

    _prepare() {
      this.config = Adapt.config.get('_spoor');
      if (!this.isEnabled) {
        Adapt.offlineStorage.setReadyStatus();
        return;
      }
      this.statefulSession = new StatefulSession();
      this.offlineStorage = new OfflineStorage(this.statefulSession);
      // force offlineStorage-scorm to initialise suspendDataStore - this allows
      // us to do things like store the user's chosen language before the rest
      // of the course data loads
      Adapt.offlineStorage.get();
      Adapt.offlineStorage.setReadyStatus();
      // setup debug window keyboard shortcut
      require(['libraries/jquery.keycombo'], function() {
        // listen for user holding 'd', 'e', 'v' keys together
        $.onKeyCombo([68, 69, 86], function() {
          Adapt.spoor.scorm.showDebugWindow();
        });
      });
    }

    get isEnabled() {
      return (this.config && this.config._isEnabled);
    }

  }

  Adapt.spoor = new Spoor();

  return Spoor;

});
