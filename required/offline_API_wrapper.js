var GenericAPI = {

  __offlineAPIWrapper: true,
  __storageWarningTimeoutId: null,

  store: function(force) {
    if (window.ISCOOKIELMS === false) return;

    if (!force && window.Cookies.get('_spoor') === undefined) return;

    window.Cookies.set('_spoor', this.data);

    // a length mismatch will most likely indicate cookie storage limit exceeded
    if (window.Cookies.get('_spoor').length !== JSON.stringify(this.data).length) {
      // defer call to avoid excessive alerts
      if (this.__storageWarningTimeoutId == null) {
        this.__storageWarningTimeoutId = setTimeout(function() {
          this.storageWarning();
        }.bind(this), 1000);
      }
    }
  },

  fetch: function() {
    if (window.ISCOOKIELMS === false) {
      this.data = {};
      return;
    }

    this.data = window.Cookies.getJSON('_spoor');

    if (!this.data) {
      this.data = {};
      return false;
    }

    return true;
  },

  reset: function() {
    window.Cookies.remove('_spoor');
  },

  createResetButton: function() {
    $('body').append($('<style id="spoor-clear-button">.spoor-reset-button { position:fixed; right:0px; bottom:0px; } </style>'));
    var $button = $('<button class="spoor-reset-button btn-text">Reset</button>');
    $('body').append($button);
    $button.on('click', function(e) {
      if (!e.shiftKey) {
        this.reset();
        alert('SCORM tracking cookie has been deleted! Tip: shift-click reset to preserve cookie.');
      }
      window.location = window.location.pathname;
    }.bind(this));
  },

  storageWarning: function() {
    var Adapt;
    var notificationMethod = alert;
    this.__storageWarningTimeoutId = null;
    if (require) Adapt = require('core/js/adapt');
    if (Adapt && Adapt.config && Adapt.config.has('_spoor')) {
      if (Adapt.config.get('_spoor')._advancedSettings &&
        Adapt.config.get('_spoor')._advancedSettings._suppressErrors === true) {
        notificationMethod = console.error;
      }
    }
    notificationMethod('Warning: possible cookie storage limit exceeded - tracking may malfunction');
  }

};

// SCORM 1.2 API
window.API = {

  LMSInitialize: function() {
    const Adapt = require('core/js/adapt');
    
    if (window.ISCOOKIELMS !== false && Adapt?.config?.get('_spoor')?._showCookieLmsResetButton) {
      this.createResetButton();
    }
    if (!this.fetch()) {
      this.data['cmi.core.lesson_status'] = 'not attempted';
      this.data['cmi.suspend_data'] = '';
      this.data['cmi.core.student_name'] = 'Surname, Sam';
      this.data['cmi.core.student_id'] = 'sam.surname@example.org';
      this.store(true);
    }
    return 'true';
  },

  LMSFinish: function() {
    return 'true';
  },

  LMSGetValue: function(key) {
    return this.data[key];
  },

  LMSSetValue: function(key, value) {
    var str = 'cmi.interactions.';
    if (key.indexOf(str) !== -1) return 'true';

    this.data[key] = value;

    this.store();
    return 'true';
  },

  LMSCommit: function() {
    return 'true';
  },

  LMSGetLastError: function() {
    return 0;
  },

  LMSGetErrorString: function() {
    return 'Fake error string.';
  },

  LMSGetDiagnostic: function() {
    return 'Fake diagnostic information.';
  }
};

// SCORM 2004 API
window.API_1484_11 = {

  Initialize: function() {
    const Adapt = require('core/js/adapt');

    if (window.ISCOOKIELMS !== false && Adapt?.config?.get('_spoor')?._showCookieLmsResetButton) {
      this.createResetButton();
    }
    if (!this.fetch()) {
      this.data['cmi.completion_status'] = 'not attempted';
      this.data['cmi.suspend_data'] = '';
      this.data['cmi.learner_name'] = 'Surname, Sam';
      this.data['cmi.learner_id'] = 'sam.surname@example.org';
      this.store(true);
    }
    return 'true';
  },

  Terminate: function() {
    return 'true';
  },

  GetValue: function(key) {
    return this.data[key];
  },

  SetValue: function(key, value) {
    var str = 'cmi.interactions.';
    if (key.indexOf(str) !== -1) return 'true';

    this.data[key] = value;

    this.store();
    return 'true';
  },

  Commit: function() {
    return 'true';
  },

  GetLastError: function() {
    return 0;
  },

  GetErrorString: function() {
    return 'Fake error string.';
  },

  GetDiagnostic: function() {
    return 'Fake diagnostic information.';
  }

};

for (var key in GenericAPI) {
  window.API[key] = window.API_1484_11[key] = GenericAPI[key];
}

