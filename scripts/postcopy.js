
module.exports = async function(fs, path, log, options, done) {
  const buildPath = options.outputdir;
  const coursePath = `${buildPath}course`;
  const data = await fs.promises.readFile(`${coursePath}/config.json`).catch(error => {
    log(error);
  });
  if (!data) return done();
  const config = JSON.parse(data.toString());
  const scormVersion = config?._spoor?._advancedSettings?._scormVersion ?? '1.2';
  const scormPath = `${options.plugindir}/scorm/${scormVersion}`;
  const files = await fs.promises.readdir(`${scormPath}`).catch(error => {
    log(error);
  });
  if (!files) return done();
  const promises = files.map(file => {
    return fs.promises.copyFile(`${scormPath}/${file}`, `${buildPath}/${file}`).catch(error => {
      log(error);
    });
  });
  await Promise.all(promises);
  done();
};
