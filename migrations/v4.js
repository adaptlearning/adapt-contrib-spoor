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
 * removal was missed from legacy schema in v4.1.1 and applied in v5.0.0
 */
describe('adapt-contrib-spoor - v2.0.0 to v4.1.1', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v4.1.1', { name: 'adapt-contrib-spoor', version: '<4.1.1'});
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
  updatePlugin('adapt-contrib-spoor - update to v4.1.1', {name: 'adapt-contrib-spoor', version: '4.1.1', framework: '>=5.17.8'})
});

describe('adapt-contrib-spoor - v2.0.0 to v4.2.0', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.0 to v4.2.0', { name: 'adapt-contrib-spoor', version: '<4.2.0'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where missing _spoor._tracking._shouldCompress', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    return !hasKey(spoorConfig._tracking, '_shouldCompress');
  });
  mutateContent('adapt-contrib-spoor - add _spoor._tracking._shouldCompress', async () => {
    setObjectPathValue(spoorConfig, '_tracking._shouldCompress', false)
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldCompress added', async () => {
    const isValid = hasKey(spoorConfig._tracking, '_shouldCompress');
    if (!isValid) throw new Error('_spoor._tracking._shouldCompress not added');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v4.2.0', {name: 'adapt-contrib-spoor', version: '4.2.0', framework: '>=5.17.8'})
});