import {
  describe,
  whereFromPlugin,
  whereContent,
  mutateContent,
  checkContent,
  updatePlugin,
  getConfig,
  testStopWhere,
  testSuccessWhere
} from 'adapt-migrations';
import _ from 'lodash';

function getSpoorConfig() {
  return getConfig()?._spoor;
}

/**
 * `_tracking._shouldStoreResponse` default updated to `true` - also applied in v2.0.2 task when added with a different default value
 */
describe('adapt-contrib-spoor - to v3.0.0', async () => {
  let config, spoorConfig;
  const shouldStoreResponsesPath = '_tracking._shouldStoreResponses';
  const oldRequireCourseCompletedPath = '_tracking._requireCourseCompleted';
  const requireContentCompletedPath = '_completionCriteria._requireContentCompleted';
  const oldRequireAssessmentPassedPath = '_tracking._requireAssessmentPassed';
  const requireAssessmentCompletedPath = '_completionCriteria._requireAssessmentCompleted';
  whereFromPlugin('adapt-contrib-spoor - from <v3.0.0', { name: 'adapt-contrib-spoor', version: '<3.0.0' });

  whereContent('adapt-contrib-spoor - where _spoor', async () => {
    config = getConfig();
    spoorConfig = getSpoorConfig();
    return spoorConfig;
  });

  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldStoreResponses', async () => {
    if (!_.has(spoorConfig, shouldStoreResponsesPath)) _.set(spoorConfig, shouldStoreResponsesPath, true);
    return true;
  });

  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireCourseCompleted with _completionCriteria._requireContentCompleted', async () => {
    if (!_.has(config, requireContentCompletedPath)) _.set(config, requireContentCompletedPath, _.get(spoorConfig, oldRequireCourseCompletedPath, true));
    _.unset(spoorConfig, oldRequireCourseCompletedPath);
    return true;
  });

  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireAssessmentPassed with _completionCriteria._requireAssessmentCompleted', async () => {
    if (!_.has(config, requireAssessmentCompletedPath)) _.set(config, requireAssessmentCompletedPath, _.get(spoorConfig, oldRequireAssessmentPassedPath, false));
    _.unset(spoorConfig, oldRequireAssessmentPassedPath);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldStoreResponses added', async () => {
    const isValid = _.has(spoorConfig, shouldStoreResponsesPath);
    if (!isValid) throw new Error(`_spoor.${shouldStoreResponsesPath} not added`);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireCourseCompleted replaced', async () => {
    const isValid = !_.has(spoorConfig, oldRequireCourseCompletedPath) && _.has(config, requireContentCompletedPath);
    if (!isValid) throw new Error(`_spoor.${oldRequireCourseCompletedPath} not replaced`);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireAssessmentPassed replaced', async () => {
    const isValid = !_.has(spoorConfig, oldRequireAssessmentPassedPath) && _.has(config, requireAssessmentCompletedPath);
    if (!isValid) throw new Error(`_spoor.${oldRequireAssessmentPassedPath} not replaced`);
    return true;
  });

  updatePlugin('adapt-contrib-spoor - update to v3', { name: 'adapt-contrib-spoor', version: '3.0.0', framework: '>=3.0.0' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.13' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with populated spoor._tracking', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.13' }],
    content: [
      { _type: 'config', _spoor: { _tracking: { _requireCourseCompleted: false, _requireAssessmentPassed: true } } }
    ]
  });

  testSuccessWhere('config with empty spoor._tracking', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.13' }],
    content: [
      { _type: 'config', _spoor: { _tracking: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '2.0.13' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.0.0' }]
  });
});

describe('adapt-contrib-spoor - to v3.2.0', async () => {
  let spoorConfig;
  const manifestIdentifierPath = '_advancedSettings._manifestIdentifier';
  whereFromPlugin('adapt-contrib-spoor - from <v3.2.0', { name: 'adapt-contrib-spoor', version: '<3.2.0' });

  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._manifestIdentifier', async () => {
    spoorConfig = getSpoorConfig();
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, manifestIdentifierPath);
  });

  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._manifestIdentifier', async () => {
    _.set(spoorConfig, manifestIdentifierPath, 'adapt_manifest');
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._manifestIdentifier added', async () => {
    const isValid = _.has(spoorConfig, manifestIdentifierPath);
    if (!isValid) throw new Error(`_spoor.${manifestIdentifierPath} not added`);
    return true;
  });

  updatePlugin('adapt-contrib-spoor - update to v3.2.0', { name: 'adapt-contrib-spoor', version: '3.2.0', framework: '>=3.5.0' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.1.0' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with spoor._advancedSettings', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.1.0' }],
    content: [
      { _type: 'config', _spoor: { _advancedSettings: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.1.0' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.2.0' }]
  });
});

describe('adapt-contrib-spoor - to v3.3.0', async () => {
  let spoorConfig;
  const exitStateIfIncompletePath = '_advancedSettings._exitStateIfIncomplete';
  const exitStateIfCompletePath = '_advancedSettings._exitStateIfComplete';
  whereFromPlugin('adapt-contrib-spoor - from <v3.3.0', { name: 'adapt-contrib-spoor', version: '<3.3.0' });

  whereContent('adapt-contrib-spoor - where missing exit status', async () => {
    spoorConfig = getSpoorConfig();
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, exitStateIfIncompletePath) || !_.has(spoorConfig, exitStateIfCompletePath);
  });

  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._exitStateIfIncomplete', async () => {
    if (!_.has(spoorConfig, exitStateIfIncompletePath)) _.set(spoorConfig, exitStateIfIncompletePath, 'auto');
    return true;
  });

  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._exitStateIfComplete', async () => {
    if (!_.has(spoorConfig, exitStateIfCompletePath)) _.set(spoorConfig, exitStateIfCompletePath, 'auto');
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._exitStateIfIncomplete added', async () => {
    const isValid = _.has(spoorConfig, exitStateIfIncompletePath);
    if (!isValid) throw new Error(`_spoor.${exitStateIfIncompletePath} not added`);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._exitStateIfComplete added', async () => {
    const isValid = _.has(spoorConfig, exitStateIfCompletePath);
    if (!isValid) throw new Error(`_spoor.${exitStateIfCompletePath} not added`);
    return true;
  });

  updatePlugin('adapt-contrib-spoor - update to v3.3.0', { name: 'adapt-contrib-spoor', version: '3.3.0', framework: '>=3.5.0' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.2.0' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with spoor._advancedSettings', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.2.0' }],
    content: [
      { _type: 'config', _spoor: { _advancedSettings: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.2.0' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.3.0' }]
  });
});

describe('adapt-contrib-spoor - to v3.4.0', async () => {
  let spoorConfig;
  const shouldStoreAttemptsPath = '_advancedSettings._shouldStoreAttempts';
  whereFromPlugin('adapt-contrib-spoor - from <v3.4.0', { name: 'adapt-contrib-spoor', version: '<3.4.0' });

  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._shouldStoreAttempts', async () => {
    spoorConfig = getSpoorConfig();
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, shouldStoreAttemptsPath);
  });

  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._shouldStoreAttempts', async () => {
    _.set(spoorConfig, shouldStoreAttemptsPath, false);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._shouldStoreAttempts added', async () => {
    const isValid = _.has(spoorConfig, shouldStoreAttemptsPath);
    if (!isValid) throw new Error(`_spoor.${shouldStoreAttemptsPath} not added`);
    return true;
  });

  updatePlugin('adapt-contrib-spoor - update to v3.4.0', { name: 'adapt-contrib-spoor', version: '3.4.0', framework: '>=5.3' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.3.0' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with spoor._advancedSettings', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.3.0' }],
    content: [
      { _type: 'config', _spoor: { _advancedSettings: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.3.0' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor config with _spoor._advancedSettings._shouldStoreAttempts', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.3.0' }],
    content: [
      { _type: 'config', _spoor: { _advancedSettings: { _shouldStoreAttempts: 'auto' } } }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.4.0' }]
  });
});

describe('adapt-contrib-spoor - to v3.5.0', async () => {
  let spoorConfig;
  const commitOnAnyChangePath = '_advancedSettings._commitOnAnyChange';
  whereFromPlugin('adapt-contrib-spoor - from <v3.5.0', { name: 'adapt-contrib-spoor', version: '<3.5.0' });

  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._commitOnAnyChange', async () => {
    spoorConfig = getSpoorConfig();
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, commitOnAnyChangePath);
  });

  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._commitOnAnyChange', async () => {
    _.set(spoorConfig, commitOnAnyChangePath, false);
    return true;
  });

  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._commitOnAnyChange added', async () => {
    const isValid = _.has(spoorConfig, commitOnAnyChangePath);
    if (!isValid) throw new Error(`_spoor.${commitOnAnyChangePath} not added`);
    return true;
  });

  updatePlugin('adapt-contrib-spoor - update to v3.5.0', { name: 'adapt-contrib-spoor', version: '3.5.0', framework: '>=5.5' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.4.0' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with spoor._advancedSettings', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.4.0' }],
    content: [
      { _type: 'config', _spoor: { _advancedSettings: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.4.0' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor config with _spoor._advancedSettings._commitOnAnyChange', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.4.0' }],
    content: [
      { _type: 'config', _spoor: { _advancedSettings: { _commitOnAnyChange: false } } }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.5.0' }]
  });
});

describe('adapt-contrib-spoor - to v3.6.0', async () => {
  let spoorConfig;
  whereFromPlugin('adapt-contrib-spoor - from <v3.6.0', { name: 'adapt-contrib-spoor', version: '<3.6.0' });

  whereContent('adapt-contrib-spoor - where missing _spoor._messages', async () => {
    spoorConfig = getSpoorConfig();
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

  updatePlugin('adapt-contrib-spoor - update to v3.6.0', { name: 'adapt-contrib-spoor', version: '3.6.0', framework: '>=5.5' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.5.0' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testStopWhere('config with spoor._messages', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.5.0' }],
    content: [
      { _type: 'config', _spoor: { _messages: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.5.0' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '3.6.0' }]
  });
});
