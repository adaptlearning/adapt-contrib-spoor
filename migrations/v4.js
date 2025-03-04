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
 * removal was missed from legacy schema in v4.1.1 and applied in v5.0.0
 */
describe('adapt-contrib-spoor - to v4.1.1', async () => {
  let config, spoorConfig;
  const oldShouldSubmitScorePath = '_tracking._shouldSubmitScore';
  const shouldSubmitScorePath = '_completionCriteria._shouldSubmitScore';
  whereFromPlugin('adapt-contrib-spoor - from <v4.1.1', { name: 'adapt-contrib-spoor', version: '<4.1.1' });

  whereContent('adapt-contrib-spoor - where _spoor', async () => {
    config = getConfig();
    spoorConfig = getSpoorConfig();
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

  updatePlugin('adapt-contrib-spoor - update to v4.1.1', { name: 'adapt-contrib-spoor', version: '4.1.1', framework: '>=5.17.8' });

  testSuccessWhere('config with empty spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '4.1.0' }],
    content: [
      { _type: 'config', _spoor: {} }
    ]
  });

  testSuccessWhere('config with default spoor._tracking', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '4.1.0' }],
    content: [
      { _type: 'config', _spoor: { _tracking: { _shouldSubmitScore: true } } }
    ]
  });

  testSuccessWhere('config with empty spoor._tracking', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '4.1.0' }],
    content: [
      { _type: 'config', _spoor: { _tracking: {} } }
    ]
  });

  testStopWhere('no spoor', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '4.1.0' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('spoor incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-spoor', version: '4.1.1' }]
  });
});
