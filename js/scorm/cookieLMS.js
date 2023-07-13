import Adapt from 'core/js/adapt';
import Cookies from 'libraries/js-cookie.js';

/** Start the mock API if window.ISCOOKIELMS exists and isn't null */
export const shouldStart = (Object.prototype.hasOwnProperty.call(window, 'ISCOOKIELMS') && window.ISCOOKIELMS !== null);

/** Store the data in a cookie if window.ISCOOKIELMS is true, otherwise setup the API without storing data. */
export const isStoringData = (window.ISCOOKIELMS === true);

export function createResetButton() {
  const resetButtonStyle = '<style id="spoor-clear-button">.spoor-reset-button { position:fixed; right:0px; bottom:0px; } </style>';
  const resetButton = '<button class="spoor-reset-button btn-text">Reset</button>';
  $('body').append($(resetButtonStyle));
  const $button = $(resetButton);
  $('body').append($button);
  $button.on('click', e => {
    if (!e.shiftKey) {
      Cookies.remove('_elfh_spoor');
      alert('SCORM tracking cookie has been deleted! Tip: shift-click reset to preserve cookie.');
    }
    window.location = window.location.pathname;
  });
}

export function configure() {
  if (!isStoringData) return;
  const spoorConfig = Adapt.config.get('_elfh_spoor');
  if (spoorConfig?._showCookieLmsResetButton) createResetButton();
  if (!spoorConfig?._shouldPersistCookieLMSData) {
    Cookies.defaults = {
      // uncomment this if you need the cookie to 'persist'. if left commented-out it will act as a 'session' cookie
      // see https://github.com/js-cookie/js-cookie/tree/latest#expires
      /* expires: 365, */
      sameSite: 'strict'
    };
  }
}

export function postStorageWarning() {
  if (postStorageWarning.__storageWarningTimeoutId !== null) return;
  postStorageWarning.__storageWarningTimeoutId = setTimeout(() => {
    const notificationMethod = (Adapt.config.get('_elfh_spoor')?._advancedSettings?._suppressErrors === true)
      ? console.error
      : alert;
    postStorageWarning.__storageWarningTimeoutId = null;
    notificationMethod('Warning: possible cookie storage limit exceeded - tracking may malfunction');
  }, 1000);
}

export function start () {

  const GenericAPI = {

    __offlineAPIWrapper: true,

    store: function(force) {
      if (!isStoringData) return;

      if (!force && Cookies.get('_elfh_spoor') === undefined) return;

      Cookies.set('_elfh_spoor', this.data);

      // a length mismatch will most likely indicate cookie storage limit exceeded
      if (Cookies.get('_elfh_spoor').length !== JSON.stringify(this.data).length) postStorageWarning();
    },

    fetch: function() {
      if (!isStoringData) {
        this.data = {};
        return;
      }

      this.data = Cookies.getJSON('_elfh_spoor');

      if (!this.data) {
        this.data = {};
        return false;
      }

      return true;
    }

  };

  // SCORM 1.2 API
  window.API = {

    ...GenericAPI,

    LMSInitialize: function() {
      configure();
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
      const str = 'cmi.interactions.';
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

    ...GenericAPI,

    Initialize: function() {
      configure();
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
      const str = 'cmi.interactions.';
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
}
