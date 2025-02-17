import { describe, whereContent, whereFromPlugin, mutateContent, checkContent, updatePlugin } from 'adapt-migrations';
import _ from 'lodash';

function getConfig(content) {
  return content.find(({ __path__ }) => __path__.endsWith('config.json'))
}

function getSpoorConfig(content) {
  return getConfig(content)?._spoor;
}

/**
 * `_tracking._shouldStoreResponse` default updated to `true` - also applied in v2.0.2 task when added with a different default value
 */
describe('adapt-contrib-spoor - v2.0.0 to v3.0.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.0.0', { name: 'adapt-contrib-spoor', version: '<3.0.0' });
  let config, spoorConfig;
  const shouldStoreResponsesPath = '_tracking._shouldStoreResponses';
  const oldRequireCourseCompletedPath = '_tracking._requireCourseCompleted';
  const requireContentCompletedPath = '_completionCriteria._requireContentCompleted';
  const oldRequireAssessmentPassedPath = '_tracking._requireAssessmentPassed';
  const requireAssessmentCompletedPath = '_completionCriteria._requireAssessmentCompleted';
  whereContent('adapt-contrib-spoor - where _spoor', async content => {
    config = getConfig(content);
    spoorConfig = getSpoorConfig(content);
    return spoorConfig;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldStoreResponses', async () => {
    if (!_.has(spoorConfig, shouldStoreResponsesPath)) _.set(spoorConfig, shouldStoreResponsesPath, true);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldStoreResponses added', async () => {
    const isValid = _.has(spoorConfig, shouldStoreResponsesPath)
    if (!isValid) throw new Error(`_spoor.${shouldStoreResponsesPath} not added`);
    return true;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireCourseCompleted with _completionCriteria._requireContentCompleted', async () => {
    if (!_.has(config, requireContentCompletedPath)) _.set(config, requireContentCompletedPath, _.get(spoorConfig, oldRequireCourseCompletedPath, true));
    _.unset(spoorConfig, oldRequireCourseCompletedPath);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireCourseCompleted replaced', async () => {
    const isValid = !_.has(spoorConfig, oldRequireCourseCompletedPath) && _.has(config, requireContentCompletedPath);
    if (!isValid) throw new Error(`_spoor.${oldRequireCourseCompletedPath} not replaced`);
    return true;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireAssessmentPassed with _completionCriteria._requireAssessmentCompleted', async () => {
    if (!_.has(config, requireAssessmentCompletedPath)) _.set(config, requireAssessmentCompletedPath, _.get(spoorConfig, oldRequireAssessmentPassedPath, false));
    _.unset(spoorConfig, oldRequireAssessmentPassedPath);
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireAssessmentPassed replaced', async () => {
    const isValid = !_.has(spoorConfig, oldRequireAssessmentPassedPath) && _.has(config, requireAssessmentCompletedPath);
    if (!isValid) throw new Error(`_spoor.${oldRequireAssessmentPassedPath} not replaced`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3', { name: 'adapt-contrib-spoor', version: '3.0.0', framework: '>=3.0.0' });
});

describe('adapt-contrib-spoor - v2.0.0 to v3.2.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.2.0', { name: 'adapt-contrib-spoor', version: '<3.2.0' });
  let spoorConfig;
  const manifestIdentifierPath = '_advancedSettings._manifestIdentifier';
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._manifestIdentifier', async content => {
    spoorConfig = getSpoorConfig(content);
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
});

describe('adapt-contrib-spoor - v2.0.0 to v3.3.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.3.0', { name: 'adapt-contrib-spoor', version: '<3.3.0' });
  let spoorConfig;
  const exitStateIfIncompletePath = '_advancedSettings._exitStateIfIncomplete';
  const exitStateIfCompletePath = '_advancedSettings._exitStateIfComplete';
  whereContent('adapt-contrib-spoor - where missing exit status', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !_.has(spoorConfig, exitStateIfIncompletePath) || !_.has(spoorConfig, exitStateIfCompletePath);
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._exitStateIfIncomplete', async () => {
    if (!_.has(spoorConfig, exitStateIfIncompletePath)) _.set(spoorConfig, exitStateIfIncompletePath, 'auto');
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._exitStateIfIncomplete added', async () => {
    const isValid = _.has(spoorConfig, exitStateIfIncompletePath);
    if (!isValid) throw new Error(`_spoor.${exitStateIfIncompletePath} not added`);
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._advancedSettings._exitStateIfComplete', async () => {
    if (!_.has(spoorConfig, exitStateIfCompletePath)) _.set(spoorConfig, exitStateIfCompletePath, 'auto');
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._exitStateIfComplete added', async () => {
    const isValid = _.has(spoorConfig, exitStateIfCompletePath);
    if (!isValid) throw new Error(`_spoor.${exitStateIfCompletePath} not added`);
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3.3.0', { name: 'adapt-contrib-spoor', version: '3.3.0', framework: '>=3.5.0' });
});

describe('adapt-contrib-spoor - v2.0.0 to v3.4.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.4.0', { name: 'adapt-contrib-spoor', version: '<3.4.0' });
  let spoorConfig;
  const shouldStoreAttemptsPath = '_advancedSettings._shouldStoreAttempts';
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._shouldStoreAttempts', async content => {
    spoorConfig = getSpoorConfig(content);
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
});

describe('adapt-contrib-spoor - v2.0.0 to v3.5.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.5.0', { name: 'adapt-contrib-spoor', version: '<3.5.0' });
  let spoorConfig;
  const commitOnAnyChangePath = '_advancedSettings._commitOnAnyChange';
  whereContent('adapt-contrib-spoor - where missing _spoor._advancedSettings._commitOnAnyChange', async content => {
    spoorConfig = getSpoorConfig(content);
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
});

describe('adapt-contrib-spoor - v2.0.0 to v3.6.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v3.6.0', { name: 'adapt-contrib-spoor', version: '<3.6.0' });
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
  updatePlugin('adapt-contrib-spoor - update to v3.6.0', { name: 'adapt-contrib-spoor', version: '3.6.0', framework: '>=5.5' });
});