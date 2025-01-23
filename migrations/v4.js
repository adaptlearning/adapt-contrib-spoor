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

// @todo: removal was missed from legacy schema - should this be bumped to v5.0 where fully removed?
describe('adapt-contrib-spoor - v1 to v4.1.1', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v4.1.1', { name: 'adapt-contrib-spoor', version: '<4.1.1'});
  let config, spoorConfig;
  whereContent('adapt-contrib-spoor - where _spoor._tracking._shouldSubmitScore', async content => {
    config = getConfig(content);
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (!hasKey(spoorConfig._tracking, '_shouldSubmitScore')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._shouldSubmitScore with _completionCriteria._shouldSubmitScore', async () => {
    if (!hasKey(config._completionCriteria, '_shouldSubmitScore')) config._completionCriteria._shouldSubmitScore = spoorConfig._tracking._shouldSubmitScore;
    delete spoorConfig._tracking._shouldSubmitScore;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldSubmitScore replaced', async () => {
    const isValid = !hasKey(spoorConfig._tracking, '_shouldSubmitScore') && hasKey(config._completionCriteria, '_shouldSubmitScore');
    if (!isValid) throw new Error('_spoor._tracking._shouldSubmitScore not replaced');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v4.1.1', {name: 'adapt-contrib-spoor', version: '4.1.1', framework: '>=5.17.8'})
});

describe('adapt-contrib-spoor - v1 to v4.2', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1 to v4.2', { name: 'adapt-contrib-spoor', version: '<4.2'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._tracking._shouldCompress', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (hasKey(spoorConfig._tracking, '_shouldCompress')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldCompress', async () => {
    spoorConfig._tracking._shouldCompress = false;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldCompress added', async () => {
    const isValid = hasKey(spoorConfig._tracking, '_shouldCompress');
    if (!isValid) throw new Error('_spoor._tracking._shouldCompress not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v4.2', {name: 'adapt-contrib-spoor', version: '4.2', framework: '>=5.17.8'})
});