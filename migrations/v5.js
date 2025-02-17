import { describe, whereContent, whereFromPlugin, mutateContent, checkContent, updatePlugin } from 'adapt-migrations';
import _ from 'lodash';

function getConfig(content) {
  return content.find(({ __path__ }) => __path__.endsWith('config.json'))
}

function getSpoorConfig(content) {
  return getConfig(content)?._spoor;
}

/**
 * removal was missed from legacy schema in v4.1.1
 */
describe('adapt-contrib-spoor - v2.0.0 to v5.0.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.0.0', { name: 'adapt-contrib-spoor', version: '<5.0.0' });
  let config, spoorConfig;
  const oldShouldSubmitScorePath = '_tracking._shouldSubmitScore';
  const shouldSubmitScorePath = '_completionCriteria._shouldSubmitScore';
  whereContent('adapt-contrib-spoor - where _spoor', async content => {
    config = getConfig(content);
    spoorConfig = getSpoorConfig(content);
    return spoorConfig;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._shouldSubmitScore with _completionCriteria._shouldSubmitScore', async () => {
    if (!_.has(config, shouldSubmitScorePath)) _.set(config, shouldSubmitScorePath, _.get(spoorConfig, oldShouldSubmitScorePath, false));
    _.unset(spoorConfig, oldShouldSubmitScorePath);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldSubmitScore replaced', async () => {
    const isValid = !_.has(spoorConfig, oldShouldSubmitScorePath) && _.has(config, shouldSubmitScorePath);
    if (!isValid) throw new Error(`_spoor.${oldShouldSubmitScorePath} not replaced`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.0.0', { name: 'adapt-contrib-spoor', version: '5.0.0', framework: '>=5.19.1' });
});

describe('adapt-contrib-spoor - v2.0.0 to v5.3.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.3.0', { name: 'adapt-contrib-spoor', version: '<5.3.0' });
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._showCookieLmsResetButton', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, '_showCookieLmsResetButton');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._showCookieLmsResetButton', async () => {
    spoorConfig._showCookieLmsResetButton = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._showCookieLmsResetButton added', async () => {
    const isValid = _.has(spoorConfig, '_showCookieLmsResetButton');
    if (!isValid) throw new Error('_spoor._showCookieLmsResetButton not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.3.0', { name: 'adapt-contrib-spoor', version: '5.3.0', framework: '>=5.19.6' });
});

/**
 * `_advancedSettings._setCompletedWhenFailed` added to legacy schema but task updated to use v5.5.2 value
 */
describe('adapt-contrib-spoor - v2.0.0 to v5.4.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.4.0', { name: 'adapt-contrib-spoor', version: '<5.4.0' });
  let spoorConfig;
  const setCompletedWhenFailedPath = '_advancedSettings._setCompletedWhenFailed';
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._setCompletedWhenFailed', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, setCompletedWhenFailedPath);
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._setCompletedWhenFailed', async () => {
    _.set(spoorConfig, setCompletedWhenFailedPath, true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._setCompletedWhenFailed added', async () => {
    const isValid = _.has(spoorConfig, setCompletedWhenFailedPath);
    if (!isValid) throw new Error(`_spoor.${setCompletedWhenFailedPath} not added`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.4.0', { name: 'adapt-contrib-spoor', version: '5.4.0', framework: '>=5.19.6' });
});

/**
 * `_tracking._shouldStoreResponse` default updated to `true` - also applied in v5.4.0 task when added to legacy schema with a different default value
 */
describe('adapt-contrib-spoor - v2.0.0 to v5.5.2', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v5.4.0 to v5.5.2', { name: 'adapt-contrib-spoor', version: '<5.5.2' });
  let spoorConfig;
  const setCompletedWhenFailedPath = '_advancedSettings._setCompletedWhenFailed';
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._setCompletedWhenFailed', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, setCompletedWhenFailedPath);
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._setCompletedWhenFailed', async () => {
    _.set(spoorConfig, setCompletedWhenFailedPath, true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._setCompletedWhenFailed added', async () => {
    const isValid = _.has(spoorConfig, setCompletedWhenFailedPath);
    if (!isValid) throw new Error(`_spoor.${setCompletedWhenFailedPath} not added`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.5.2', { name: 'adapt-contrib-spoor', version: '5.5.2', framework: '>=5.24' });
});

describe('adapt-contrib-spoor - v2.0.0 to v5.5.7', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.5.7', { name: 'adapt-contrib-spoor', version: '<5.5.7' });
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._shouldPersistCookieLMSData', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, '_shouldPersistCookieLMSData');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._shouldPersistCookieLMSData', async () => {
    spoorConfig._shouldPersistCookieLMSData = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._shouldPersistCookieLMSData added', async () => {
    const isValid = _.has(spoorConfig, '_shouldPersistCookieLMSData');
    if (!isValid) throw new Error('_spoor._shouldPersistCookieLMSData not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.5.7', { name: 'adapt-contrib-spoor', version: '5.5.7', framework: '>=5.24' });
});

describe('adapt-contrib-spoor - v2.0.0 to v5.6.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.6.0', { name: 'adapt-contrib-spoor', version: '<5.6.0' });
  let spoorConfig;
  const connectionTestPath = '_advancedSettings._connectionTest';
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._connectionTest', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, connectionTestPath);
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._connectionTest', async () => {
    _.set(spoorConfig, connectionTestPath, {
      _isEnabled: true,
      _testOnSetValue: true,
      _silentRetryLimit: 2,
      _silentRetryDelay: 1000
    });
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._connectionTest added', async () => {
    const isValid = _.has(spoorConfig, connectionTestPath);
    if (!isValid) throw new Error(`_spoor.${connectionTestPath} not added`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.6.0', { name: 'adapt-contrib-spoor', version: '5.6.0', framework: '>=5.28.1' });
});

describe('adapt-contrib-spoor - v2.0.0 to v5.7.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.7.0', { name: 'adapt-contrib-spoor', version: '<5.7.0' });
  let spoorConfig;
  const uniqueInteractionIdsPath = '_advancedSettings._uniqueInteractionIds';
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._uniqueInteractionIds', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, uniqueInteractionIdsPath);
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._uniqueInteractionIds', async () => {
    _.set(spoorConfig, uniqueInteractionIdsPath, false);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._uniqueInteractionIds added', async () => {
    const isValid = _.has(spoorConfig, uniqueInteractionIdsPath);
    if (!isValid) throw new Error(`_spoor.${uniqueInteractionIdsPath} not added`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.7.0', { name: 'adapt-contrib-spoor', version: '5.7.0', framework: '>=5.28.1' });
});

describe('adapt-contrib-spoor - v2.0.0 to v5.8.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.8.0', { name: 'adapt-contrib-spoor', version: '<5.8.0' });
  let spoorConfig;
  const maxCharLimitOverridePath = '_advancedSettings._maxCharLimitOverride';
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._maxCharLimitOverride', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, maxCharLimitOverridePath);
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._maxCharLimitOverride', async () => {
    _.set(spoorConfig, maxCharLimitOverridePath, 0);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._maxCharLimitOverride added', async () => {
    const isValid = _.has(spoorConfig, maxCharLimitOverridePath);
    if (!isValid) throw new Error(`_spoor.${maxCharLimitOverridePath} not added`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.8.0', { name: 'adapt-contrib-spoor', version: '5.8.0', framework: '>=5.28.1' });
});

/**
 * added to schemas in v5.9.8 but attribute added in v5.9.0
 */
describe('adapt-contrib-spoor - v2.0.0 to v5.9.8', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v5.9.8', { name: 'adapt-contrib-spoor', version: '<5.9.8' });
  let spoorConfig;
  const shouldRecordObjectivesPath = '_tracking._shouldRecordObjectives';
  whereContent('adapt-contrib-spoor - where missing _spoor._tracking._shouldRecordObjectives', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, shouldRecordObjectivesPath);
  });
  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldRecordObjectives', async () => {
    _.set(spoorConfig, shouldRecordObjectivesPath, true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldRecordObjectives added', async () => {
    const isValid = _.has(spoorConfig, shouldRecordObjectivesPath);
    if (!isValid) throw new Error(`_spoor.${shouldRecordObjectivesPath} not added`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.9.8', { name: 'adapt-contrib-spoor', version: '5.9.8', framework: '>=5.31.31' });
});