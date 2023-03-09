module.exports = async function(fs, path, log, options, done) {
  try {
    const buildPath = options.outputdir;
    const coursePath = `${buildPath}${options.coursedir}`;
    const data = await fs.promises.readFile(`${coursePath}/config.json`);
    if (!data) return done();
    const config = JSON.parse(data.toString());
    const scormVersion = config?._spoor?._advancedSettings?._scormVersion ?? '1.2';
    const scormPath = `${options.plugindir}/scorm/${scormVersion}`;
    const files = await fs.promises.readdir(`${scormPath}`);
    if (!files) return done();
    await Promise.all(files.map(file => fs.promises.copyFile(`${scormPath}/${file}`, `${buildPath}/${file}`)));
  } catch (err) {
    log(err);
  }
  done();
};
