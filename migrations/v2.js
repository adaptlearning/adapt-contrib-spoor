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
 * @todo: update value regardless of whether it had been changed by author - even if using the original default, by fixing it we will actually be altering the current functionality which may not be desired?
 * does an author definitely see a list of changes and can revert back manually if required?
 */
describe('adapt-contrib-spoor - v1 > v2.0.2', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1', { name: 'adapt-contrib-spoor', version: '<=2.0.2'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where _spoor._tracking._requireCourseCompleted', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (!hasKey(spoorConfig._tracking, '_requireCourseCompleted')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - update _spoor._tracking._requireCourseCompleted default', async () => {
    spoorConfig._tracking._requireCourseCompleted = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireCourseCompleted updated', async () => {
    const isValid = spoorConfig._tracking._requireCourseCompleted;
    if (!isValid) throw new Error('_spoor._tracking._requireCourseCompleted not updated');
    return true;
  });
  whereContent('adapt-contrib-spoor - where _spoor._advancedSettings._commitOnStatusChange', async () => {
    if (!hasKey(spoorConfig._advancedSettings, '_commitOnStatusChange')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - update _spoor._advancedSettings._commitOnStatusChange default', async () => {
    spoorConfig._advancedSettings._commitOnStatusChange = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._commitOnStatusChange updated', async () => {
    const isValid = spoorConfig._advancedSettings._commitOnStatusChange;
    if (!isValid) throw new Error('_spoor._advancedSettings._commitOnStatusChange not updated');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v2.0.2', {name: 'adapt-contrib-spoor', version: '2.0.2', framework: '>=2'})
});

/**
 * the following new attributes have default values or conditions that mean migration isn't required
 * _tracking: _shouldStoreResponses
 * _reporting: _resetStatusOnLanguageChange
 * _advancedSettings: _shouldRecordInteractions, _commitOnVisibilityChangeHidden, _suppressErrors
 */
