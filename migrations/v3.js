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
 * `_tracking._shouldStoreResponse` default updated to `true` - also applied in v2.0.2 task when added with a different default value
 */
describe('adapt-contrib-spoor - v2.0.0 to v3.0.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.0.0', { name: 'adapt-contrib-spoor', version: '<3.0.0'});
  let config, spoorConfig;
  whereContent('adapt-contrib-spoor - where _spoor', async content => {
    config = getConfig(content);
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
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireCourseCompleted with _completionCriteria._requireContentCompleted', async () => {
    if (!hasKey(config._completionCriteria, '_requireContentCompleted')) setObjectPathValue(config, '_completionCriteria._requireContentCompleted', spoorConfig?._tracking?._requireCourseCompleted ?? true);
    delete spoorConfig?._tracking?._requireCourseCompleted;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireCourseCompleted replaced', async () => {
    const isValid = !hasKey(spoorConfig._tracking, '_requireCourseCompleted') && hasKey(config._completionCriteria, '_requireContentCompleted');
    if (!isValid) throw new Error('_spoor._tracking._requireCourseCompleted not replaced');
    return true;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireAssessmentPassed with _completionCriteria._requireAssessmentCompleted', async () => {
    if (!hasKey(config._completionCriteria, '_requireAssessmentCompleted')) setObjectPathValue(config, '_completionCriteria._requireAssessmentCompleted', spoorConfig?._tracking?._requireAssessmentPassed ?? false);
    delete spoorConfig?._tracking?._requireAssessmentPassed;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireAssessmentPassed replaced', async () => {
    const isValid = !hasKey(spoorConfig._tracking, '_requireAssessmentPassed') && hasKey(config._completionCriteria, '_requireAssessmentCompleted');
    if (!isValid) throw new Error('_spoor._tracking._requireAssessmentPassed not replaced');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3', {name: 'adapt-contrib-spoor', version: '3.0.0', framework: '>=3.0.0'})
});

describe('adapt-contrib-spoor - v2.0.0 to v3.2.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.2.0', { name: 'adapt-contrib-spoor', version: '<3.2.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._manifestIdentifier', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_manifestIdentifier');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._manifestIdentifier', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._manifestIdentifier', 'adapt_manifest');
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._manifestIdentifier added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_manifestIdentifier');
    if (!isValid) throw new Error('_spoor._advancedSettings._manifestIdentifier not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.2.0', {name: 'adapt-contrib-spoor', version: '3.2.0', framework: '>=3.5.0'})
});

describe('adapt-contrib-spoor - v2.0.0 to v3.3.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.3.0', { name: 'adapt-contrib-spoor', version: '<3.3.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing exit status', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_exitStateIfIncomplete') || !hasKey(spoorConfig._advancedSettings, '_exitStateIfComplete');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._exitStateIfIncomplete', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._exitStateIfIncomplete', 'auto');
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._exitStateIfIncomplete added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_exitStateIfIncomplete');
    if (!isValid) throw new Error('_spoor._advancedSettings._exitStateIfIncomplete not added');
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._exitStateIfComplete', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._exitStateIfComplete', 'auto');
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._exitStateIfComplete added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_exitStateIfComplete');
    if (!isValid) throw new Error('_spoor._advancedSettings._exitStateIfComplete not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.3.0', {name: 'adapt-contrib-spoor', version: '3.3.0', framework: '>=3.5.0'})
});

describe('adapt-contrib-spoor - v2.0.0 to v3.4.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.4.0', { name: 'adapt-contrib-spoor', version: '<3.4.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._shouldStoreAttempts', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_shouldStoreAttempts');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._shouldStoreAttempts', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._shouldStoreAttempts', false);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._shouldStoreAttempts added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_shouldStoreAttempts');
    if (!isValid) throw new Error('_spoor._advancedSettings._shouldStoreAttempts not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.4.0', {name: 'adapt-contrib-spoor', version: '3.4.0', framework: '>=5.3'})
});

describe('adapt-contrib-spoor - v2.0.0 to v3.5.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.5.0', { name: 'adapt-contrib-spoor', version: '<3.5.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._commitOnAnyChange', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_commitOnAnyChange');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._commitOnAnyChange', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._commitOnAnyChange', false);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._commitOnAnyChange added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_commitOnAnyChange');
    if (!isValid) throw new Error('_spoor._advancedSettings._commitOnAnyChange not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.5.0', {name: 'adapt-contrib-spoor', version: '3.5.0', framework: '>=5.5'})
});

describe('adapt-contrib-spoor - v2.0.0 to v3.6.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.6.0', { name: 'adapt-contrib-spoor', version: '<3.6.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._messages', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !spoorConfig._messages;
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
  updatePlugin('adapt-contrib-spoor - update to v3.6.0', {name: 'adapt-contrib-spoor', version: '3.6.0', framework: '>=5.5'})
});