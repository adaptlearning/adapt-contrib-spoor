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
 * @todo: should the plugin be responsible for adding _completionCriteria._requireContentCompleted or will that be handled by adapt-contrib-core?
 * @todo: should the plugin be responsible for adding _completionCriteria._requireAssessmentCompleted or will that be handled by adapt-contrib-core?
 * @todo: do we need to delete attributes if no longer present in the schema (needed for framework build but not AAT)?
 */
describe('adapt-contrib-spoor - v1 > v3', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v1', { name: 'adapt-contrib-spoor', version: '<=3'});
  let config, spoorConfig;
  whereContent('adapt-contrib-spoor - where _spoor._tracking._requireCourseCompleted', async content => {
    config = getConfig(content);
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (!hasKey(spoorConfig._tracking, '_requireCourseCompleted')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireCourseCompleted with _completionCriteria._requireContentCompleted', async () => {
    if (!hasKey(config._completionCriteria, '_requireContentCompleted')) config._completionCriteria._requireContentCompleted = spoorConfig._tracking._requireCourseCompleted;
    delete spoorConfig._tracking._requireCourseCompleted;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireCourseCompleted replaced', async () => {
    const isValid = !hasKey(spoorConfig._tracking, '_requireCourseCompleted') && hasKey(config._completionCriteria, '_requireContentCompleted');
    if (!isValid) throw new Error('_spoor._tracking._requireCourseCompleted not replaced');
    return true;
  });
  whereContent('adapt-contrib-spoor - where _spoor._tracking._requireAssessmentPassed', async () => {
    if (!hasKey(spoorConfig._tracking, '_requireAssessmentPassed')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - replace _spoor._tracking._requireAssessmentPassed with _completionCriteria._requireAssessmentCompleted', async () => {
    if (!hasKey(config._completionCriteria, '_requireAssessmentCompleted')) config._completionCriteria._requireAssessmentCompleted = spoorConfig._tracking._requireAssessmentPassed;
    delete spoorConfig._tracking._requireAssessmentPassed;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._requireAssessmentPassed replaced', async () => {
    const isValid = !hasKey(spoorConfig._tracking, '_requireAssessmentPassed') && hasKey(config._completionCriteria, '_requireAssessmentCompleted');
    if (!isValid) throw new Error('_spoor._tracking._requireAssessmentPassed not replaced');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3', {name: 'adapt-contrib-spoor', version: '3', framework: '>=3'})
});

/**
 * @todo: update value regardless of whether it had been changed by author - even if using the original default, by fixing it we will actually be altering the current functionality which may not be desired?
 * does an author definitely see a list of changes and can revert back manually if required?
 */
describe('adapt-contrib-spoor - v2.0.2 > v3', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v2.0.2', { name: 'adapt-contrib-spoor', version: '<=3'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where _spoor._tracking._shouldStoreResponses', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!hasKey(spoorConfig._tracking, '_shouldStoreResponses')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - update _spoor._tracking._shouldStoreResponses default', async () => {
    spoorConfig._tracking._shouldStoreResponses = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._tracking._shouldStoreResponses updated', async () => {
    const isValid = spoorConfig._tracking._shouldStoreResponses;
    if (!isValid) throw new Error('_spoor._tracking._shouldStoreResponses not updated');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v3', {name: 'adapt-contrib-spoor', version: '3', framework: '>=3'})
});

/**
 * the following new attributes have default values or conditions that mean migration isn't required
 * _messages
 * _advancedSettings: _commitOnAnyChange, _shouldStoreAttempts, _exitStateIfIncomplete, _exitStateIfComplete, _manifestIdentifier
 */
