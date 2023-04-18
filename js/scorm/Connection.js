import Adapt from 'core/js/adapt';

export default class Connection {

  constructor({
    _isEnabled = true,
    _silentRetryLimit = 2,
    _silentRetryDelay = 1000,
    _testOnSetValue = true
  } = {}, ScormWrapper) {
    this.test = this.test.bind(this);
    this._isEnabled = _isEnabled;
    this._isInProgress = false;
    this._isSilentDisconnection = false;
    this._isDisconnected = false;
    this._silentRetryLimit = _silentRetryLimit;
    this._silentRetryDelay = _silentRetryDelay;
    this._silentRetryTimeout = null;
    this._silentRetryCount = 0;
    this._testOnSetValue = _testOnSetValue;
    this._scorm = ScormWrapper;
  }

  async test() {
    if (!this._isEnabled || this._isInProgress) return;
    this._isInProgress = true;
    try {
      const response = await fetch(`connection.txt?nocache=${Date.now()}`);
      if (response?.ok) return this.onConnectionSuccess();
    } catch (err) {}
    this.onConnectionError();
  }

  async testOnSetValue() {
    if (!this._isEnabled || !this._testOnSetValue) return;
    return this.test();
  }

  reset() {
    this._silentRetryCount = 0;
    this._isSilentDisconnection = false;
    if (this._silentRetryTimeout === null) return;
    window.clearTimeout(this._silentRetryTimeout);
    this._silentRetryTimeout = null;
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
      this._silentRetryTimeout = window.setTimeout(this.test, this._silentRetryDelay);
      return;
    }
    this.reset();
    this._scorm.handleConnectionError(this.test);
  }

}
