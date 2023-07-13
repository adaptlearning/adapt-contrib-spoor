class Logger {

  constructor() {
    this.logArr = [];
    this.registeredViews = [];
  }

  static getInstance() {
    if (Logger.instance === null) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  getEntries() {
    return this.logArr;
  }

  getLastEntry() {
    return this.logArr[this.logArr.length - 1];
  }

  info(str) {
    this.logArr[this.logArr.length] = { str: str, type: Logger.LOG_TYPE_INFO, time: Date.now() };
    this.updateViews();
  }

  warn(str) {
    this.logArr[this.logArr.length] = { str: str, type: Logger.LOG_TYPE_WARN, time: Date.now() };
    this.updateViews();
  }

  error(str) {
    this.logArr[this.logArr.length] = { str: str, type: Logger.LOG_TYPE_ERROR, time: Date.now() };
    this.updateViews();
  }

  debug(str) {
    this.logArr[this.logArr.length] = { str: str, type: Logger.LOG_TYPE_DEBUG, time: Date.now() };
    this.updateViews();
  }

  registerView(_view) {
    this.registeredViews[this.registeredViews.length] = _view;
  }

  unregisterView(_view) {
    for (let i = 0, l = this.registeredViews.length; i < l; i++) {
      if (this.registeredViews[i] !== _view) continue;
      this.registeredViews.splice(i, 1);
      i--;
    }
  }

  updateViews() {
    for (let i = 0, l = this.registeredViews.length; i < l; i++) {
      if (!this.registeredViews[i]) continue;
      this.registeredViews[i].update(this);
    }
  }

}

Logger.instance = null;
Logger.LOG_TYPE_INFO = 0;
Logger.LOG_TYPE_WARN = 1;
Logger.LOG_TYPE_ERROR = 2;
Logger.LOG_TYPE_DEBUG = 3;

// Assign global reference for debug window
export default (window.Logger = Logger);
