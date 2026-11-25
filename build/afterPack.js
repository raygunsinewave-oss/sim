// Ad-hoc sign the packed .app so Apple Silicon Macs will launch it without a paid Developer ID.
const { execSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`[afterPack] ad-hoc signing ${appPath}`);
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
  execSync(`codesign --verify --deep --strict --verbose=2 "${appPath}"`, { stdio: 'inherit' });
};
