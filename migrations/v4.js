import { describe, whereContent, whereFromPlugin, mutateContent, checkContent, updatePlugin } from 'adapt-migrations';
import _ from 'lodash';

function getConfig(content) {
  return content.find(({ __path__ }) => __path__.endsWith('config.json'))
}

function getSpoorConfig(content) {
  return getConfig(content)?._spoor;
}

/**
 * removal was missed from legacy schema in v4.1.1 and applied in v5.0.0
 */
describe('adapt-contrib-spoor - v2.0.0 to v4.1.1', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v4.1.1', { name: 'adapt-contrib-spoor', version: '<4.1.1' });
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
  updatePlugin('adapt-contrib-spoor - update to v4.1.1', { name: 'adapt-contrib-spoor', version: '4.1.1', framework: '>=5.17.8' });
});
