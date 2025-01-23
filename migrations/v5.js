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

describe('adapt-contrib-spoor - v1 to v5.3', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v5.', { name: 'adapt-contrib-spoor', version: '<5.3'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._showCookieLmsResetButton', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_showCookieLmsResetButton')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._showCookieLmsResetButton', async () => {
    spoorConfig._advancedSettings._showCookieLmsResetButton = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._showCookieLmsResetButton added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_showCookieLmsResetButton');
    if (!isValid) throw new Error('_spoor._advancedSettings._showCookieLmsResetButton not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.3', {name: 'adapt-contrib-spoor', version: '5.3', framework: '>=5.19.6'})
});

describe('adapt-contrib-spoor - v1 to v5.4', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v5.4', { name: 'adapt-contrib-spoor', version: '<5.4'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._setCompletedWhenFailed', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_setCompletedWhenFailed')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._setCompletedWhenFailed', async () => {
    spoorConfig._advancedSettings._setCompletedWhenFailed = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._setCompletedWhenFailed added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_setCompletedWhenFailed');
    if (!isValid) throw new Error('_spoor._advancedSettings._setCompletedWhenFailed not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.4', {name: 'adapt-contrib-spoor', version: '5.4', framework: '>=5.19.6'})
});

describe('adapt-contrib-spoor - v1 to v5.5.1', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v5.5.1', { name: 'adapt-contrib-spoor', version: '<5.5.1'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._scormVersion', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_scormVersion')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._scormVersion', async () => {
    spoorConfig._advancedSettings._scormVersion = "1.2";
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
 * v5.4 to v5.5.2 - the following attributes default values changed - migration not included as not possible to discern author values from defaults:
 * _advancedSettings: _setCompletedWhenFailed
 */

describe('adapt-contrib-spoor - v1 to v5.5.7', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v5.5.7', { name: 'adapt-contrib-spoor', version: '<5.5.7'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._shouldPersistCookieLMSData', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_shouldPersistCookieLMSData')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._shouldPersistCookieLMSData', async () => {
    spoorConfig._advancedSettings._shouldPersistCookieLMSData = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._shouldPersistCookieLMSData added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_shouldPersistCookieLMSData');
    if (!isValid) throw new Error('_spoor._advancedSettings._shouldPersistCookieLMSData not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.5.7', {name: 'adapt-contrib-spoor', version: '5.5.7', framework: '>=5.24'})
});

describe('adapt-contrib-spoor - v1 to v5.6', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v5.6', { name: 'adapt-contrib-spoor', version: '<5.6'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._connectionTest', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_connectionTest')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._connectionTest', async () => {
    spoorConfig._advancedSettings._connectionTest ={
      _isEnabled: true,
      _testOnSetValue: true,
      _silentRetryLimit: 2,
      _silentRetryDelay: 1000
    };
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._connectionTest added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_connectionTest');
    if (!isValid) throw new Error('_spoor._advancedSettings._connectionTest not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.6', {name: 'adapt-contrib-spoor', version: '5.6', framework: '>=5.28.1'})
});

describe('adapt-contrib-spoor - v1 to v5.7', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v5.7', { name: 'adapt-contrib-spoor', version: '<5.7'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._uniqueInteractionIds', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_uniqueInteractionIds')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._uniqueInteractionIds', async () => {
    spoorConfig._advancedSettings._uniqueInteractionIds = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._uniqueInteractionIds added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_uniqueInteractionIds');
    if (!isValid) throw new Error('_spoor._advancedSettings._uniqueInteractionIds not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.7', {name: 'adapt-contrib-spoor', version: '5.7', framework: '>=5.28.1'})
});

describe('adapt-contrib-spoor - v1 to v5.8', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v5.8', { name: 'adapt-contrib-spoor', version: '<5.8'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._maxCharLimitOverride', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_maxCharLimitOverride')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._maxCharLimitOverride', async () => {
    spoorConfig._advancedSettings._maxCharLimitOverride = 0;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._maxCharLimitOverride added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_maxCharLimitOverride');
    if (!isValid) throw new Error('_spoor._advancedSettings._maxCharLimitOverride not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.8', {name: 'adapt-contrib-spoor', version: '5.8', framework: '>=5.28.1'})
});

// @note: added to schemas in v5.9.8 but attribute added in v5.9
describe('adapt-contrib-spoor - v1 to v5.9.8', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v5.9.8', { name: 'adapt-contrib-spoor', version: '<5.9.8'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._shouldRecordObjectives', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._advancedSettings, '_shouldRecordObjectives')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._shouldRecordObjectives', async () => {
    spoorConfig._advancedSettings._shouldRecordObjectives = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._shouldRecordObjectives added', async () => {
    const isValid = hasKey(spoorConfig._advancedSettings, '_shouldRecordObjectives');
    if (!isValid) throw new Error('_spoor._advancedSettings._shouldRecordObjectives not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.9.8', {name: 'adapt-contrib-spoor', version: '5.9.8', framework: '>=5.31.31'})
});