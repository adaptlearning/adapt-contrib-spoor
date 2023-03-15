import Adapt from 'core/js/adapt';

export default class Connection {

  constructor({
    _isEnabled = false,
    _silentRetryLimit = 0,
    _silentRetryDelay = 2000
  } = {}, ScormWrapper) {
    this._isEnabled = _isEnabled;
    this._isInProgress = false;
    this._isSilentDisconnection = false;
    this._isDisconnected = false;
    this._silentRetryLimit = _silentRetryLimit;
    this._silentRetryDelay = _silentRetryDelay;
    this._silentRetryTimeout = null;
    this._silentRetryCount = 0;
    this._scorm = ScormWrapper;
  }

  async test() {
    if (!this._isEnabled || this._isInProgress) return;
    this._isInProgress = true;

    fetch(`connection.json?nocache=${Date.now()}`)
    .then(response => {
      (response?.ok) ? this.onConnectionSuccess() : this.onConnectionError();
    })
    .catch(error => {
      this.onConnectionError();
    });
  }

  reset() {
    this._silentRetryCount = 0;
    this._isSilentDisconnection = false;

    if (this._silentRetryTimeout !== null) {
      window.clearTimeout(this._silentRetryTimeout);
      this._silentRetryTimeout = null;
    }
  }

  stop() {
    this.reset();
    this._isEnabled = false;
  }

  /**
   * @todo Remove need for commit?
   */
  onConnectionSuccess() {
    if (this._isDisconnected) {
      this._scorm.commit();
      if (!this._isSilentDisconnection) Adapt.trigger('tracking:connectionSuccess');
    }

    this._isInProgress = false;
    this._isDisconnected = false;
    this.reset();
  }

  onConnectionError() {
    if (!this._isEnabled) return;
    this._isInProgress = false;
    this._isDisconnected = true;

    if (this._silentRetryCount < this._silentRetryLimit) {
      this._isSilentDisconnection = true;
      this._silentRetryCount++;
      this._silentRetryTimeout = window.setTimeout(this.test.bind(this), this._silentRetryDelay);
    } else {
      this.reset();
      Adapt.trigger('tracking:connectionError', this.test.bind(this));
    }
  }

}
