import Adapt from 'core/js/adapt';

export default class Connection {

  constructor({
    _isEnabled = false,
    _silentRetryLimit = 2,
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
    this.scorm = ScormWrapper.getInstance();
  }

  test() {
    if (!this._isEnabled || this._isInProgress) return;

    this._isInProgress = true;

    // @todo: replace with fetch and polyfill for IE11?
    const xhr = new XMLHttpRequest();

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          this.onConnectionSuccess();
        } else {
          this.onConnectionError();
        }
      }
    };

    xhr.open('GET', 'connection.json?nocache=' + Date.now());
    // xhr.setRequestHeader("Accept", "application/json");
    xhr.send();
  }

  reset() {
    this._silentRetryCount = 0;
    this._isSilentDisconnection = false;

    if (this._silentRetryTimeout !== null) {
      window.clearTimeout(this._silentRetryTimeout);
      this._silentRetryTimeout = null;
    }
  }

  onConnectionSuccess() {
    if (this._isDisconnected) {
      this.scorm.getInstance().commit();

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
