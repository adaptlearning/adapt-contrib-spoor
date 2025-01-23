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

/**
 * v3.0.0 - the following attributes default values changed - migration not included as not possible to discern author values from defaults:
 * _tracking: _shouldStoreResponses
 */

describe('adapt-contrib-spoor - v1 to v3', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v3', { name: 'adapt-contrib-spoor', version: '<3'});
  let config, spoorConfig;
  whereContent('adapt-contrib-spoor - where using legacy tracking config', async content => {
    config = getConfig(content);
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (!hasKey(spoorConfig._tracking, '_requireCourseCompleted') && !hasKey(spoorConfig._tracking, '_requireAssessmentPassed')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireCourseCompleted with _completionCriteria._requireContentCompleted', async () => {
    if (!hasKey(config._completionCriteria, '_requireContentCompleted')) config._completionCriteria._requireContentCompleted = spoorConfig?._tracking?._requireCourseCompleted ?? true;
    delete spoorConfig._tracking._requireCourseCompleted;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireCourseCompleted replaced', async () => {
    const isValid = !hasKey(spoorConfig._tracking, '_requireCourseCompleted') && hasKey(config._completionCriteria, '_requireContentCompleted');
    if (!isValid) throw new Error('_spoor._tracking._requireCourseCompleted not replaced');
    return true;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireAssessmentPassed with _completionCriteria._requireAssessmentCompleted', async () => {
    if (!hasKey(config._completionCriteria, '_requireAssessmentCompleted')) config._completionCriteria._requireAssessmentCompleted = spoorConfig?._tracking?._requireAssessmentPassed ?? false;
    delete spoorConfig._tracking._requireAssessmentPassed;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireAssessmentPassed replaced', async () => {
    const isValid = !hasKey(spoorConfig._tracking, '_requireAssessmentPassed') && hasKey(config._completionCriteria, '_requireAssessmentCompleted');
    if (!isValid) throw new Error('_spoor._tracking._requireAssessmentPassed not replaced');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3', {name: 'adapt-contrib-spoor', version: '3', framework: '>=3'})
});

describe('adapt-contrib-spoor - v1 to v3.2', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v3.2', { name: 'adapt-contrib-spoor', version: '<3.2'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._manifestIdentifier', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_manifestIdentifier')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._manifestIdentifier', async () => {
    spoorConfig._advancedSettings._manifestIdentifier = 'adapt_manifest';
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._manifestIdentifier added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_manifestIdentifier');
    if (!isValid) throw new Error('_spoor._advancedSettings._manifestIdentifier not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.2', {name: 'adapt-contrib-spoor', version: '3.2', framework: '>=3.5'})
});

describe('adapt-contrib-spoor - v1 to v3.3', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v3.3', { name: 'adapt-contrib-spoor', version: '<3.3'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing exit status', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_exitStateIfIncomplete') && hasKey(spoorConfig._advancedSettings, '_exitStateIfComplete')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._exitStateIfIncomplete', async () => {
    if (!hasKey(spoorConfig._advancedSettings, '_exitStateIfIncomplete')) spoorConfig._advancedSettings._exitStateIfIncomplete = 'auto';
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._exitStateIfIncomplete added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_exitStateIfIncomplete');
    if (!isValid) throw new Error('_spoor._advancedSettings._exitStateIfIncomplete not added');
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._exitStateIfComplete', async () => {
    if (!hasKey(spoorConfig._advancedSettings, '_exitStateIfComplete')) spoorConfig._advancedSettings._exitStateIfComplete = 'auto';
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._exitStateIfComplete added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_exitStateIfComplete');
    if (!isValid) throw new Error('_spoor._advancedSettings._exitStateIfComplete not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.3', {name: 'adapt-contrib-spoor', version: '3.3', framework: '>=3.5'})
});

describe('adapt-contrib-spoor - v1 to v3.4', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v3.4', { name: 'adapt-contrib-spoor', version: '<3.4'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._shouldStoreAttempts', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_shouldStoreAttempts')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._shouldStoreAttempts', async () => {
    spoorConfig._advancedSettings._shouldStoreAttempts = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._shouldStoreAttempts added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_shouldStoreAttempts');
    if (!isValid) throw new Error('_spoor._advancedSettings._shouldStoreAttempts not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.4', {name: 'adapt-contrib-spoor', version: '3.4', framework: '>=5.3'})
});

describe('adapt-contrib-spoor - v1 to v3.5', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v3.5', { name: 'adapt-contrib-spoor', version: '<3.5'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._commitOnAnyChange', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_commitOnAnyChange')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._commitOnAnyChange', async () => {
    spoorConfig._advancedSettings._commitOnAnyChange = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._commitOnAnyChange added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_commitOnAnyChange');
    if (!isValid) throw new Error('_spoor._advancedSettings._commitOnAnyChange not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.5', {name: 'adapt-contrib-spoor', version: '3.5', framework: '>=5.5'})
});

describe('adapt-contrib-spoor - v1 to v3.6', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v3.6', { name: 'adapt-contrib-spoor', version: '<3.6'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._messages', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (spoorConfig._messages) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._messages', async () => {
    spoorConfig._messages = {};
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._messages added', async () => {
    const isValid = spoorConfig._messages;
    if (!isValid) throw new Error('_spoor._messages not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.6', {name: 'adapt-contrib-spoor', version: '3.6', framework: '>=5.5'})
});