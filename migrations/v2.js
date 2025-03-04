import {
  describe,
  whereFromPlugin,
  whereContent,
  mutateContent,
  checkContent,
  updatePlugin,
  getConfig,
  testSuccessWhere,
  testStopWhere
} from 'adapt-migrations';
import _ from 'lodash';

function getSpoorConfig() {
  return getConfig()?._spoor;
}

/**
 * `_tracking._shouldStoreResponse` default set to false but task updated to use v3.0.0 value
 * the following attributes were missing default values - migration not included as not possible to discern author values from defaults:
 * _isEnabled
 * _tracking: _requireCourseCompleted, _requireAssessmentPassed, _shouldSubmitScore
 * _reporting: _onTrackingCriteriaMet, _onAssessmentFailure
 * _advancedSettings: _showDebugWindow, _commitOnStatusChange, _timedCommitFrequency, _maxCommitRetries, _commitRetryDelay
 */
describe('adapt-contrib-spoor - to v2.0.2', async () => {
  let spoorConfig;
  const shouldStoreResponsesPath = '_tracking._shouldStoreResponses';
  const scormVersionPath = '_advancedSettings._scormVersion';
  whereFromPlugin('adapt-contrib-spoor - from <v2.0.2', { name: 'adapt-contrib-spoor', version: '<2.0.2' });

  whereContent('adapt-contrib-spoor - where _spoor', async () => {
    spoorConfig = getSpoorConfig();
    return spoorConfig;
  });

  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldStoreResponses', async () => {
    if (!_.has(spoorConfig, shouldStoreResponsesPath)) _.set(spoorConfig, shouldStoreResponsesPath, true);
    return true;
  });

  mutateContent('adapt-contrib-spoor - remove _spoor._advancedSettings._scormVersion', async () => {
    _.unset(spoorConfig, scormVersionPath);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldStoreResponses added', async () => {
    const isValid = _.has(spoorConfig, shouldStoreResponsesPath);
    if (!isValid) throw new Error(`_spoor.${shouldStoreResponsesPath} not added`);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._scormVersion removed', async () => {
    const isValid = !_.has(spoorConfig, scormVersionPath);
    if (!isValid) throw new Error(`_spoor.${scormVersionPath} not removed`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.2', { name: 'adapt-contrib-spoor', version: '2.0.2', framework: '>=2.0.0' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.1' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with spoor._tracking/spoor._advancedSettings', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.1' }],
    content: [
      { _type: 'config', _spoor: { _tracking: {}, _advancedSettings: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.1' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.2' }]
  });
});

describe('adapt-contrib-spoor - to v2.0.5', async () => {
  let spoorConfig;
  const suppressErrorsPath = '_advancedSettings._suppressErrors';
  whereFromPlugin('adapt-contrib-spoor - from <v2.0.5', { name: 'adapt-contrib-spoor', version: '<2.0.5' });

  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._suppressErrors', async () => {
    spoorConfig = getSpoorConfig();
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, suppressErrorsPath);
  });

  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._suppressErrors', async () => {
    _.set(spoorConfig, suppressErrorsPath, false);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._suppressErrors added', async () => {
    const isValid = _.has(spoorConfig, suppressErrorsPath);
    if (!isValid) throw new Error(`_spoor.${suppressErrorsPath} not added`);
    return true;
  });

  updatePlugin('adapt-contrib-spoor - update to v2.0.5', { name: 'adapt-contrib-spoor', version: '2.0.5', framework: '>=2.0.0' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.4' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with spoor._advancedSettings', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.4' }],
    content: [
      { _type: 'config', _spoor: { _advancedSettings: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.4' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.5' }]
  });
});

describe('adapt-contrib-spoor - to v2.0.11', async () => {
  let spoorConfig;
  const commitOnVisibilityChangeHiddenPath = '_advancedSettings._commitOnVisibilityChangeHidden';
  whereFromPlugin('adapt-contrib-spoor - from <v2.0.11', { name: 'adapt-contrib-spoor', version: '<2.0.11' });

  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._commitOnVisibilityChangeHidden', async () => {
    spoorConfig = getSpoorConfig();
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, commitOnVisibilityChangeHiddenPath);
  });

  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._commitOnVisibilityChangeHidden', async () => {
    _.set(spoorConfig, commitOnVisibilityChangeHiddenPath, true);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._commitOnVisibilityChangeHidden added', async () => {
    const isValid = _.has(spoorConfig, commitOnVisibilityChangeHiddenPath);
    if (!isValid) throw new Error(`_spoor.${commitOnVisibilityChangeHiddenPath} not added`);
    return true;
  });

  updatePlugin('adapt-contrib-spoor - update to v2.0.11', { name: 'adapt-contrib-spoor', version: '2.0.11', framework: '>=2.0.0' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.10' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with spoor._advancedSettings', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.10' }],
    content: [
      { _type: 'config', _spoor: { _advancedSettings: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.10' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.11' }]
  });
});

describe('adapt-contrib-spoor - to v2.0.13', async () => {
  let spoorConfig;
  const resetStatusOnLanguageChangePath = '_reporting._resetStatusOnLanguageChange';
  whereFromPlugin('adapt-contrib-spoor - from <v2.0.13', { name: 'adapt-contrib-spoor', version: '<2.0.13' });

  whereContent('adapt-contrib-spoor - where missing _spoor._reporting._resetStatusOnLanguageChange', async () => {
    spoorConfig = getSpoorConfig();
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, resetStatusOnLanguageChangePath);
  });

  mutateContent('adapt-contrib-spoor - add _spoor._reporting._resetStatusOnLanguageChange', async () => {
    _.set(spoorConfig, resetStatusOnLanguageChangePath, false);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._reporting._resetStatusOnLanguageChange added', async () => {
    const isValid = _.has(spoorConfig, resetStatusOnLanguageChangePath);
    if (!isValid) throw new Error(`_spoor.${resetStatusOnLanguageChangePath} not added`);
    return true;
  });

  updatePlugin('adapt-contrib-spoor - update to v2.0.13', { name: 'adapt-contrib-spoor', version: '2.0.13', framework: '>=2.0.0' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.12' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with spoor._reporting', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.12' }],
    content: [
      { _type: 'config', _spoor: { _reporting: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.12' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.13' }]
  });
});

/**
 * added to schemas in v2.1.1 but attribute added in v2.0.5
 */
describe('adapt-contrib-spoor - to v2.1.1', async () => {
  let spoorConfig;
  const shouldRecordInteractionsPath = '_tracking._shouldRecordInteractions';
  whereFromPlugin('adapt-contrib-spoor - from <v2.1.1', { name: 'adapt-contrib-spoor', version: '<2.1.1' });

  whereContent('adapt-contrib-spoor - where missing _spoor._tracking._shouldRecordInteractions', async () => {
    spoorConfig = getSpoorConfig();
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, shouldRecordInteractionsPath);
  });

  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldRecordInteractions', async () => {
    _.set(spoorConfig, shouldRecordInteractionsPath, true);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldRecordInteractions added', async () => {
    const isValid = _.has(spoorConfig, shouldRecordInteractionsPath);
    if (!isValid) throw new Error(`_spoor.${shouldRecordInteractionsPath} not added`);
    return true;
  });

  updatePlugin('adapt-contrib-spoor - update to v2.1.1', { name: 'adapt-contrib-spoor', version: '2.1.1', framework: '>=2.0.16' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.12' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with spoor._tracking', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.12' }],
    content: [
      { _type: 'config', _spoor: { _tracking: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.12' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.13' }]
  });
});
