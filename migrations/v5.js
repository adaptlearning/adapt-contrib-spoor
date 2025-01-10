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
describe('adapt-contrib-spoor - v5.4.0 > v5.5.1', async () => {
  whereFromPlugin('adapt-contrib-spoor - from v5.4.0', { name: 'adapt-contrib-spoor', version: '<=5.5.1'});
  let spoorConfig;
  whereContent('adapt-contrib-spoor - where _spoor._advancedSettings._setCompletedWhenFailed', async content => {
    spoorConfig = getSpoorConfig(content);
    if (!spoorConfig) return false;
    if (!hasKey(spoorConfig._advancedSettings, '_setCompletedWhenFailed')) return false;
    return true;
  });
  mutateContent('adapt-contrib-spoor - update _spoor._advancedSettings._setCompletedWhenFailed default', async () => {
    spoorConfig._advancedSettings._setCompletedWhenFailed = true;
    return true;
  });
  checkContent('adapt-contrib-spoor - check _spoor._advancedSettings._setCompletedWhenFailed updated', async () => {
    const isValid = spoorConfig._advancedSettings._setCompletedWhenFailed;
    if (!isValid) throw new Error('_spoor._advancedSettings._setCompletedWhenFailed not updated');
    return true;
  });
  updatePlugin('adapt-contrib-spoor - update to v5.5.1', {name: 'adapt-contrib-spoor', version: '5.5.1', framework: '>=5.24'})
});

/**
 * the following new attributes have default values or conditions that mean migration isn't required
 * _shouldPersistCookieLMSData (not sure this is setup correctly), _showCookieLmsResetButton
 * _tracking: _recordObjectives
 * _advancedSettings: _maxCharLimitOverride, _uniqueInteractionIds, _connectionTest, _scormVersion
 */
