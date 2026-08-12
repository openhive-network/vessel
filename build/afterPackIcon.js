// electron-builder afterPack hook — adopt the macOS 26 (Tahoe) layered app icon.
//
// electron-builder only ships a legacy .icns, which macOS 26 cannot recolor for the system icon
// appearances (Default / Dark / Clear / Tinted — the "colorless"/tinted Dock). This compiles the
// Icon Composer bundle build/vessel.icon (icon.json + Assets/) with `actool` into Assets.car and wires
// it via CFBundleIconName, so a packaged Vessel.app gets the proper system-tinted icon on Tahoe while
// keeping the .icns (CFBundleIconFile) as the fallback for macOS < 26.
//
// Runs after packing, before signing (so the added Assets.car + edited Info.plist get signed).
// Requires Xcode 26+/actool on the build machine (macOS 26). If actool is missing or the compile
// fails, it logs a warning and leaves the .icns-only bundle intact — packaging still succeeds.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

exports.default = async function afterPackIcon(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const iconDir = path.join(__dirname, 'vessel.icon');
  if (!fs.existsSync(iconDir)) {
    console.warn(`[afterPackIcon] ${iconDir} not found — skipping Tahoe icon.`);
    return;
  }

  const appName = context.packager.appInfo.productFilename; // "Vessel"
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const resourcesDir = path.join(appPath, 'Contents', 'Resources');
  const infoPlist = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(resourcesDir) || !fs.existsSync(infoPlist)) {
    console.warn(`[afterPackIcon] unexpected bundle layout at ${appPath} — skipping.`);
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-icon-'));
  const partialPlist = path.join(tmp, 'partial.plist');
  try {
    execFileSync(
      'xcrun',
      [
        'actool', iconDir,
        '--compile', tmp,
        '--output-format', 'human-readable-text',
        '--notices', '--warnings', '--errors',
        '--output-partial-info-plist', partialPlist,
        '--app-icon', 'vessel',
        '--include-all-app-icons',
        '--enable-on-demand-resources', 'NO',
        '--development-region', 'en',
        '--target-device', 'mac',
        '--minimum-deployment-target', '26.0',
        '--platform', 'macosx',
      ],
      { stdio: 'pipe' }
    );
  } catch (e) {
    console.warn('[afterPackIcon] actool failed (needs Xcode 26 / macOS 26) — shipping .icns only.');
    console.warn(String((e && e.stderr) || e).slice(0, 500));
    return;
  }

  const car = path.join(tmp, 'Assets.car');
  if (!fs.existsSync(car)) {
    console.warn('[afterPackIcon] actool produced no Assets.car — skipping.');
    return;
  }
  fs.copyFileSync(car, path.join(resourcesDir, 'Assets.car'));

  // macOS 26 reads CFBundleIconName -> the "vessel" icon in Assets.car. Leave the existing
  // CFBundleIconFile (.icns) untouched as the pre-Tahoe fallback.
  const pb = '/usr/libexec/PlistBuddy';
  try {
    execFileSync(pb, ['-c', 'Add :CFBundleIconName string vessel', infoPlist], { stdio: 'pipe' });
  } catch {
    execFileSync(pb, ['-c', 'Set :CFBundleIconName vessel', infoPlist], { stdio: 'pipe' });
  }

  console.log('[afterPackIcon] macOS 26 layered icon installed (Assets.car + CFBundleIconName=vessel).');
};
