import { describe , whereContent, whereFromPlugin, whereToPlugin, mutateContent, checkContent, updatePlugin } from 'adapt-migrations';

function getConfig(content) {
  return content.find(({ __path__ }) => __path__ === 'src/course/config.json');
}

function getSpoorConfig(content) {
  const config = getConfig(content);
  return config?._spoor;
}

function hasKey(object, key) {
  if (!object) return false;
  return Object.hasOwn(object, key);
}

/**
 * @todo: should the plugin be responsible for adding _completionCriteria._shouldSubmitScore or will that be handled by adapt-contrib-core?
 *
 */
describe('adapt-contrib-spoor - v1 > v4.1.1', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1', { name: 'adapt-contrib-spoor', version: '<=4.1.1'});
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

/**
 * the following new attributes have default values or conditions that mean migration isn't required
 * _tracking: _shouldCompress
 */
