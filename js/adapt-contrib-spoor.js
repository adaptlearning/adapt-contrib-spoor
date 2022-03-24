import Adapt from 'core/js/adapt';
import ScormWrapper from './scorm/wrapper';
import StatefulSession from './adapt-stateful-session';
import OfflineStorage from './adapt-offlineStorage-scorm';
import offlineStorage from 'core/js/offlineStorage';

class Spoor extends Backbone.Controller {

  initialize() {
    this.config = null;
    this.scorm = ScormWrapper.getInstance();
    this.listenToOnce(Adapt, 'offlineStorage:prepare', this._prepare);
  }

  _prepare() {
    this.config = Adapt.config.get('_spoor');
    if (!this.isEnabled) {
      offlineStorage.setReadyStatus();
      return;
    }
    this.statefulSession = new StatefulSession();
    this.offlineStorage = new OfflineStorage(this.statefulSession);
    // force offlineStorage-scorm to initialise suspendDataStore - this allows
    // us to do things like store the user's chosen language before the rest
    // of the course data loads
    offlineStorage.get();
    offlineStorage.setReadyStatus();
    // setup debug window keyboard shortcut
    require(['libraries/jquery.keycombo'], () => {
      // listen for user holding 'd', 'e', 'v' keys together
      $.onKeyCombo([68, 69, 86], () => {
        Adapt.spoor.scorm.showDebugWindow();
      });
    });
  }

  get isEnabled() {
    return (this.config && this.config._isEnabled);
  }

}

Adapt.spoor = new Spoor();

export default Adapt.spoor;
