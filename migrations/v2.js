import { describe , whereContent, whereFromPlugin, whereToPlugin, mutateContent, checkContent, updatePlugin } from 'adapt-migrations';

function getConfig(content) {
  return content.find(({ __path__ }) => __path__ === 'src/course/config.json');
}

function getSpoorConfig(content) {
  return getConfig(content)?._spoor;
}

function hasKey(object, key) {
  if (!object) return false;
  return Object.hasOwn(object, key);
}

describe('adapt-contrib-spoor - v2.0.0 to v2.0.2', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.0.2', { name: 'adapt-contrib-spoor', version: '<2.0.2'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where _spoor._advancedSettings._scormVersion', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (!hasKey(spoorConfig._advancedSettings, '_scormVersion')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - remove _spoor._advancedSettings._scormVersion', async () => {
    delete spoorConfig._advancedSettings._scormVersion;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._scormVersion removed', async () => {
    const isValid = !hasKey(spoorConfig._advancedSettings, '_scormVersion');
    if (!isValid) throw new Error('_spoor._advancedSettings._scormVersion not removed');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.2', {name: 'adapt-contrib-spoor', version: '2.0.2', framework: '>=2'})
});

/**
 * <2.0.2 - the following attributes were missing default values - migration not included as not possible to discern author values from defaults:
 * _isEnabled
 * _tracking: _requireCourseCompleted, _requireAssessmentPassed, _shouldSubmitScore, _shouldStoreResponses
 * _reporting: _onTrackingCriteriaMet, _onAssessmentFailure
 * _advancedSettings: _scormVersion, _showDebugWindow, _commitOnStatusChange, _timedCommitFrequency, _maxCommitRetries, _commitRetryDelay
 */

describe('adapt-contrib-spoor - v2.0.0 to v2.0.5', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.0.5', { name: 'adapt-contrib-spoor', version: '<2.0.5'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._suppressErrors', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_suppressErrors')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._suppressErrors', async () => {
    spoorConfig._advancedSettings._suppressErrors = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._suppressErrors added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_suppressErrors');
    if (!isValid) throw new Error('_spoor._advancedSettings._suppressErrors not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.5', {name: 'adapt-contrib-spoor', version: '2.0.5', framework: '>=2'})
});

describe('adapt-contrib-spoor - v2.0.0 to v2.0.11', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.0.11', { name: 'adapt-contrib-spoor', version: '<2.0.11'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._commitOnVisibilityChangeHidden', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_commitOnVisibilityChangeHidden')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._commitOnVisibilityChangeHidden', async () => {
    spoorConfig._advancedSettings._commitOnVisibilityChangeHidden = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._commitOnVisibilityChangeHidden added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_commitOnVisibilityChangeHidden');
    if (!isValid) throw new Error('_spoor._advancedSettings._commitOnVisibilityChangeHidden not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.11', {name: 'adapt-contrib-spoor', version: '2.0.11', framework: '>=2'})
});

describe('adapt-contrib-spoor - v2.0.0 to v2.0.13', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.0.13', { name: 'adapt-contrib-spoor', version: '<2.0.13'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._reporting._resetStatusOnLanguageChange', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._reporting, '_resetStatusOnLanguageChange')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._reporting._resetStatusOnLanguageChange', async () => {
    spoorConfig._reporting._resetStatusOnLanguageChange = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._reporting._resetStatusOnLanguageChange added', async () => {
    const isValid = hasKey(spoorConfig._reporting, '_resetStatusOnLanguageChange');
    if (!isValid) throw new Error('_spoor._reporting._resetStatusOnLanguageChange not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.13', {name: 'adapt-contrib-spoor', version: '2.0.13', framework: '>=2.0.16'})
});

describe('adapt-contrib-spoor - v2.0.0 to v2.1.1', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v2.1.1', { name: 'adapt-contrib-spoor', version: '<2.1.1'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._tracking._shouldRecordInteractions', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._tracking, '_shouldRecordInteractions')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldRecordInteractions', async () => {
    spoorConfig._tracking._shouldRecordInteractions = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldRecordInteractions added', async () => {
    const isValid = hasKey(spoorConfig._tracking, '_shouldRecordInteractions');
    if (!isValid) throw new Error('_spoor._tracking._shouldRecordInteractions not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.1.1', {name: 'adapt-contrib-spoor', version: '2.1.1', framework: '>=2.0.16'})
});