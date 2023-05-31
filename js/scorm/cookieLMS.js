import Adapt from 'core/js/adapt';
import Cookies from 'libraries/js-cookie.js';

/** Start the mock API if window.ISCOOKIELMS exists and isn't null */
export const shouldStart = (Object.prototype.hasOwnProperty.call(window, 'ISCOOKIELMS') && window.ISCOOKIELMS !== null);

/** Store the data in a cookie if window.ISCOOKIELMS is true, otherwise setup the API without storing data. */
export const isStoringData = (window.ISCOOKIELMS === true);

/**
 * Store value nested inside object at given path
 * @param {Object} object Root of hierarchy
 * @param {string} path Period separated key names
 * @param {*} value Value to store at final path
 */
export const set = (object, path, value) => {
  const keys = path.split('.');
  const initialKeys = keys.slice(0, -1);
  const lastKey = keys[keys.length - 1];
  const finalObject = initialKeys.reduce((object, key) => {
    return (object[key] = object?.[key] || {});
  }, object);
  finalObject[lastKey] = value;
};

/**
 * Fetch value nested inside object at given path
 * @param {Object} object
 * @param {string} path  Period separated key names
 * @returns
 */
export const get = (object, path) => {
  const keys = path.split('.');
  return keys.reduce((object, key) => object?.[key], object);
};

export function createResetButton() {
  const resetButtonStyle = '<style id="spoor-clear-button">.spoor-reset-button { position:fixed; right:0px; bottom:0px; } </style>';
  const resetButton = '<button class="spoor-reset-button btn-text">Reset</button>';
  $('body').append($(resetButtonStyle));
  const $button = $(resetButton);
  $('body').append($button);
  $button.on('click', e => {
    if (!e.shiftKey) {
      Cookies.remove('_spoor');
      alert('SCORM tracking cookie has been deleted! Tip: shift-click reset to preserve cookie.');
    }
    window.location = window.location.pathname;
  });
}

export function configure() {
  if (!isStoringData) return;
  const spoorConfig = Adapt.config.get('_spoor');
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
    const notificationMethod = (Adapt.config.get('_spoor')?._advancedSettings?._suppressErrors === true)
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

      if (!force && Cookies.get('_spoor') === undefined) return;

      Cookies.set('_spoor', this.data);

      // a length mismatch will most likely indicate cookie storage limit exceeded
      if (Cookies.get('_spoor').length !== JSON.stringify(this.data).length) postStorageWarning();
    },

    initialize: function(defaults = {}) {
      if (!isStoringData) {
        this.data = {};
        return;
      }

      this.data = Cookies.getJSON('_spoor');

      const entries = Object.entries(this.data);
      const isUsingLegacyKeys = (entries[0][0].includes('.'));
      if (isUsingLegacyKeys) {
        /**
         * convert from: cmi.student_name = ''
         * to: { cmi: { student_name: '' } }
         */
        const reworked = {};
        Object.entries(defaults).forEach(([name, value]) => set(reworked, name, value));
        Object.entries(entries).forEach(([name, value]) => set(reworked, name, value));
        this.data = reworked;
        this.store(true);
      }

      if (!this.data) {
        this.data = {};
        Object.entries(defaults).forEach(([name, value]) => set(this.data, name, value));
        this.store(true);
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
      this.initialize({
        'cmi.interactions': [],
        'cmi.core.lesson_status': 'not attempted',
        'cmi.suspend_data': '',
        'cmi.core.student_name': 'Surname, Sam',
        'cmi.core.student_id': 'sam.surname@example.org'
      });
      return 'true';
    },

    LMSFinish: function() {
      return 'true';
    },

    LMSGetValue: function(key) {
      const value = get(this.data, key);
      const parts = key.split('.');
      if (parts[0] === 'cmi' && parts[parts.length - 1] === '_count') {
        // Treat requests for cmi.*._count as an array length query
        return get(this.data, parts.slice(0, -1).join('.'))?.length ?? 0;
      }
      return value;
    },

    LMSSetValue: function(key, value) {
      const parts = key.split('.');
      if (parts[0] === 'cmi' && parts[parts.length - 1] === '_count') {
        // Fail silently
        return 'true';
      }
      set(this.data, key, value);
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
      this.initialize({
        'cmi.interactions': [],
        'cmi.completion_status': 'not attempted',
        'cmi.suspend_data': '',
        'cmi.learner_name': 'Surname, Sam',
        'cmi.learner_id': 'sam.surname@example.org'
      });
      return 'true';
    },

    Terminate: function() {
      return 'true';
    },

    GetValue: function(key) {
      const parts = key.split('.');
      if (parts[0] === 'cmi' && parts[parts.length - 1] === '_count') {
        // Treat requests for cmi.*._count as an array length query
        return get(this.data, parts.slice(0, -1).join('.'))?.length ?? 0;
      }
      return get(this.data, key);
    },

    SetValue: function(key, value) {
      const parts = key.split('.');
      if (parts[0] === 'cmi' && parts[parts.length - 1] === '_count') {
        // Fail silently
        return 'true';
      }
      set(this.data, key, value);
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
