import { describe , whereContent, whereFromPlugin, whereToPlugin, mutateContent, checkContent, updatePlugin } from 'adapt-migrations';

function getConfig(content) {
  return content.find(({ __path__ }) => __path__.endsWith('config.json'))
}

function getSpoorConfig(content) {
  return getConfig(content)?._spoor;
}

function hasKey(object, key) {
  if (!object) return false;
  return Object.hasOwn(object, key);
}

function setObjectPathValue(object, path, value) {
  if (!object) return;
  const paths = path.split('.');
  const key = paths.pop();
  const target = paths.reduce((o, p) => {
    if (!hasKey(o, p)) o[p] = {};
    return o?.[p];
  }, object);
  if (hasKey(target, key)) return;
  target[key] = value;
}

/**
 * `_tracking._shouldStoreResponse` default set to false but task updated to use v3.0.0 value
 * the following attributes were missing default values - migration not included as not possible to discern author values from defaults:
 * _isEnabled
 * _tracking: _requireCourseCompleted, _requireAssessmentPassed, _shouldSubmitScore
 * _reporting: _onTrackingCriteriaMet, _onAssessmentFailure
 * _advancedSettings: _showDebugWindow, _commitOnStatusChange, _timedCommitFrequency, _maxCommitRetries, _commitRetryDelay
 */
describe('adapt-contrib-spoor - v2.0.0 to v2.0.2', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.0.2', { name: 'adapt-contrib-spoor', version: '<2.0.2'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where _spoor', async content => {
    spoorConfig = getSpoorConfig(content);
    return spoorConfig;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldStoreResponses', async () => {
    setObjectPathValue(spoorConfig, '_tracking._shouldStoreResponses', true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldStoreResponses added', async () => {
    const isValid = hasKey(spoorConfig._tracking, '_shouldStoreResponses');
    if (!isValid) throw new Error('_spoor._tracking._shouldStoreResponses not added');
    return true;
  });
  mutateContent('adapt-contrib-spoor - remove _spoor._advancedSettings._scormVersion', async () => {
    delete spoorConfig?._advancedSettings?._scormVersion;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._scormVersion removed', async () => {
    const isValid = !hasKey(spoorConfig._advancedSettings, '_scormVersion');
    if (!isValid) throw new Error('_spoor._advancedSettings._scormVersion not removed');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.2', {name: 'adapt-contrib-spoor', version: '2.0.2', framework: '>=2.0.0'})
});

describe('adapt-contrib-spoor - v2.0.0 to v2.0.5', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.0.5', { name: 'adapt-contrib-spoor', version: '<2.0.5'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._suppressErrors', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_suppressErrors');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._suppressErrors', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._suppressErrors', false);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._suppressErrors added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_suppressErrors');
    if (!isValid) throw new Error('_spoor._advancedSettings._suppressErrors not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.5', {name: 'adapt-contrib-spoor', version: '2.0.5', framework: '>=2.0.0'})
});

describe('adapt-contrib-spoor - v2.0.0 to v2.0.11', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.0.11', { name: 'adapt-contrib-spoor', version: '<2.0.11'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._commitOnVisibilityChangeHidden', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_commitOnVisibilityChangeHidden');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._commitOnVisibilityChangeHidden', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._commitOnVisibilityChangeHidden', true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._commitOnVisibilityChangeHidden added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_commitOnVisibilityChangeHidden');
    if (!isValid) throw new Error('_spoor._advancedSettings._commitOnVisibilityChangeHidden not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.11', {name: 'adapt-contrib-spoor', version: '2.0.11', framework: '>=2.0.0'})
});

describe('adapt-contrib-spoor - v2.0.0 to v2.0.13', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.0.13', { name: 'adapt-contrib-spoor', version: '<2.0.13'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._reporting._resetStatusOnLanguageChange', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._reporting, '_resetStatusOnLanguageChange');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._reporting._resetStatusOnLanguageChange', async () => {
    setObjectPathValue(spoorConfig, '_reporting._resetStatusOnLanguageChange', false);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._reporting._resetStatusOnLanguageChange added', async () => {
    const isValid = hasKey(spoorConfig._reporting, '_resetStatusOnLanguageChange');
    if (!isValid) throw new Error('_spoor._reporting._resetStatusOnLanguageChange not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.13', {name: 'adapt-contrib-spoor', version: '2.0.13', framework: '>=2.0.0'})
});

/**
 * added to schemas in v2.1.1 but attribute added in v2.0.5
 */
describe('adapt-contrib-spoor - v2.0.0 to v2.1.1', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.1.1', { name: 'adapt-contrib-spoor', version: '<2.1.1'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._tracking._shouldRecordInteractions', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._tracking, '_shouldRecordInteractions');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldRecordInteractions', async () => {
    setObjectPathValue(spoorConfig, '_tracking._shouldRecordInteractions', true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldRecordInteractions added', async () => {
    const isValid = hasKey(spoorConfig._tracking, '_shouldRecordInteractions');
    if (!isValid) throw new Error('_spoor._tracking._shouldRecordInteractions not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.1.1', {name: 'adapt-contrib-spoor', version: '2.1.1', framework: '>=2.0.16'})
});