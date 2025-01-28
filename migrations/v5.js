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
 * removal was missed from legacy schema in v4.1.1
 */
describe('adapt-contrib-spoor - v2.0.0 to v5.0.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.0.0', { name: 'adapt-contrib-spoor', version: '<5.0.0'});
  let config, spoorConfig;
  whereContent('adapt-contrib-spoor - where _spoor', async content => {
    config = getConfig(content);
    spoorConfig = getSpoorConfig(content);
    return spoorConfig;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._shouldSubmitScore with _completionCriteria._shouldSubmitScore', async () => {
    setObjectPathValue(config, '_completionCriteria._shouldSubmitScore', spoorConfig?._tracking?._shouldSubmitScore ?? false);
    delete spoorConfig?._tracking?._shouldSubmitScore;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldSubmitScore replaced', async () => {
    const isValid = !hasKey(spoorConfig._tracking, '_shouldSubmitScore') && hasKey(config._completionCriteria, '_shouldSubmitScore');
    if (!isValid) throw new Error('_spoor._tracking._shouldSubmitScore not replaced');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.0.0', {name: 'adapt-contrib-spoor', version: '5.0.0', framework: '>=5.19.1'})
});

describe('adapt-contrib-spoor - v2.0.0 to v5.3.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.3.0', { name: 'adapt-contrib-spoor', version: '<5.3.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._showCookieLmsResetButton', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig, '_showCookieLmsResetButton');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._showCookieLmsResetButton', async () => {
    spoorConfig._showCookieLmsResetButton = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._showCookieLmsResetButton added', async () => {
    const isValid = hasKey(spoorConfig, '_showCookieLmsResetButton');
    if (!isValid) throw new Error('_spoor._showCookieLmsResetButton not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.3.0', {name: 'adapt-contrib-spoor', version: '5.3.0', framework: '>=5.19.6'})
});

/**
 * `_advancedSettings._setCompletedWhenFailed` added to legacy schema but task updated to use v5.5.2 value
 */
describe('adapt-contrib-spoor - v2.0.0 to v5.4.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.4.0', { name: 'adapt-contrib-spoor', version: '<5.4.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._setCompletedWhenFailed', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_setCompletedWhenFailed');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._setCompletedWhenFailed', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._setCompletedWhenFailed', true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._setCompletedWhenFailed added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_setCompletedWhenFailed');
    if (!isValid) throw new Error('_spoor._advancedSettings._setCompletedWhenFailed not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.4.0', {name: 'adapt-contrib-spoor', version: '5.4.0', framework: '>=5.19.6'})
});

describe('adapt-contrib-spoor - v2.0.0 to v5.5.1', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.5.1', { name: 'adapt-contrib-spoor', version: '<5.5.1'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._scormVersion', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_scormVersion');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._scormVersion', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._scormVersion', '1.2');
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._scormVersion added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_scormVersion');
    if (!isValid) throw new Error('_spoor._advancedSettings._scormVersion not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.5.1', {name: 'adapt-contrib-spoor', version: '5.5.1', framework: '>=5.24'})
});

/**
 * `_tracking._shouldStoreResponse` default updated to `true` - also applied in v5.4.0 task when added to legacy schema with a different default value
 */
describe('adapt-contrib-spoor - v2.0.0 to v5.5.2', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v5.4.0 to v5.5.2', { name: 'adapt-contrib-spoor', version: '<5.5.2'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._setCompletedWhenFailed', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_setCompletedWhenFailed');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._setCompletedWhenFailed', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._setCompletedWhenFailed', true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._setCompletedWhenFailed added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_setCompletedWhenFailed');
    if (!isValid) throw new Error('_spoor._advancedSettings._setCompletedWhenFailed not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.5.2', {name: 'adapt-contrib-spoor', version: '5.5.2', framework: '>=5.24'})
});

describe('adapt-contrib-spoor - v2.0.0 to v5.5.7', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.5.7', { name: 'adapt-contrib-spoor', version: '<5.5.7'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._shouldPersistCookieLMSData', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig, '_shouldPersistCookieLMSData');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._shouldPersistCookieLMSData', async () => {
    spoorConfig._shouldPersistCookieLMSData = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._shouldPersistCookieLMSData added', async () => {
    const isValid = hasKey(spoorConfig, '_shouldPersistCookieLMSData');
    if (!isValid) throw new Error('_spoor._shouldPersistCookieLMSData not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.5.7', {name: 'adapt-contrib-spoor', version: '5.5.7', framework: '>=5.24'})
});

describe('adapt-contrib-spoor - v2.0.0 to v5.6.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.6.0', { name: 'adapt-contrib-spoor', version: '<5.6.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._connectionTest', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_connectionTest');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._connectionTest', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._connectionTest', {
      _isEnabled: true,
      _testOnSetValue: true,
      _silentRetryLimit: 2,
      _silentRetryDelay: 1000
    });
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._connectionTest added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_connectionTest');
    if (!isValid) throw new Error('_spoor._advancedSettings._connectionTest not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.6.0', {name: 'adapt-contrib-spoor', version: '5.6.0', framework: '>=5.28.1'})
});

describe('adapt-contrib-spoor - v2.0.0 to v5.7.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.7.0', { name: 'adapt-contrib-spoor', version: '<5.7.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._uniqueInteractionIds', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_uniqueInteractionIds');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._uniqueInteractionIds', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._uniqueInteractionIds', false);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._uniqueInteractionIds added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_uniqueInteractionIds');
    if (!isValid) throw new Error('_spoor._advancedSettings._uniqueInteractionIds not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.7.0', {name: 'adapt-contrib-spoor', version: '5.7.0', framework: '>=5.28.1'})
});

describe('adapt-contrib-spoor - v2.0.0 to v5.8.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.8.0', { name: 'adapt-contrib-spoor', version: '<5.8.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._maxCharLimitOverride', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._advancedSettings, '_maxCharLimitOverride');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._maxCharLimitOverride', async () => {
    setObjectPathValue(spoorConfig, '_advancedSettings._maxCharLimitOverride', 0);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._maxCharLimitOverride added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_maxCharLimitOverride');
    if (!isValid) throw new Error('_spoor._advancedSettings._maxCharLimitOverride not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.8.0', {name: 'adapt-contrib-spoor', version: '5.8.0', framework: '>=5.28.1'})
});

/**
 * added to schemas in v5.9.8 but attribute added in v5.9.0
 */
describe('adapt-contrib-spoor - v2.0.0 to v5.9.8', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.9.8', { name: 'adapt-contrib-spoor', version: '<5.9.8'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._tracking._shouldRecordObjectives', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._tracking, '_shouldRecordObjectives');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldRecordObjectives', async () => {
    setObjectPathValue(spoorConfig, '_tracking._shouldRecordObjectives', true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldRecordObjectives added', async () => {
    const isValid = hasKey(spoorConfig._tracking, '_shouldRecordObjectives');
    if (!isValid) throw new Error('_spoor._tracking._shouldRecordObjectives not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.9.8', {name: 'adapt-contrib-spoor', version: '5.9.8', framework: '>=5.31.31'})
});