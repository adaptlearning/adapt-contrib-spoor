Logger = function() {
	this.logArr = new Array();
	this.registeredViews = new Array();
};

// static
Logger.instance = null;
Logger.LOG_TYPE_INFO = 0;
Logger.LOG_TYPE_WARN = 1;
Logger.LOG_TYPE_ERROR = 2;
Logger.LOG_TYPE_DEBUG = 3;

Logger.getInstance = function() {
	if (Logger.instance == null)
		Logger.instance = new Logger();
	return Logger.instance;
};

Logger.prototype.getEntries = function() {
	return this.logArr;
};

Logger.prototype.getLastEntry = function() {
	return this.logArr[this.logArr.length - 1];
};

Logger.prototype.info = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_INFO};
	this.updateViews();
};

Logger.prototype.warn = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_WARN};
	this.updateViews();
};

Logger.prototype.error = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_ERROR};
	this.updateViews();
};

Logger.prototype.debug = function(str) {
	this.logArr[this.logArr.length] = {str:str, type:Logger.LOG_TYPE_DEBUG};
	this.updateViews();
};

//register a view
Logger.prototype.registerView = function(_view) {
	this.registeredViews[this.registeredViews.length] = _view;
};

//unregister a view
Logger.prototype.unregisterView = function(_view) {
	for (var i = 0; i < this.registeredViews.length; i++)
		if (this.registeredViews[i] == _view) {
			this.registeredViews.splice(i, 1);
			i--;
		}
};

// update all views
Logger.prototype.updateViews = function() {
	for (var i = 0; i < this.registeredViews.length; i++) {
		if (this.registeredViews[i])
			this.registeredViews[i].update(this);
	}
};