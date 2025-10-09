import Adapt from 'core/js/adapt';

/**
  Prevent the user from accessing SCORM API when
  config.json:_fixes._harden = true and in production mode
 */

Adapt.on('adapt:start', () => {
  const config = Adapt.config.get('_fixes');
  if (config?._harden !== true) return;
  if (window.ADAPT_BUILD_TYPE !== 'development') return;
  applyHarden();
});

function applyHarden() {
  delete window.SCORMSuspendData;
  let win = window;
  let findAttempts = 0;
  const findAttemptLimit = 500;
  while ((!win.API && !win.API_1484_11) &&
        (win.parent) &&
        (win.parent !== win) &&
        (findAttempts <= findAttemptLimit)) {
    findAttempts++;
    win = win.parent;
  }
  if (!win.API && !win.API_1484_11) return;
  delete win.API;
  delete win.API_1484_11;
}
