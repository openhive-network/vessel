// electron-builder beforePack hook — say whether this platform's package will be code-signed.
//
// Signing and notarization are configured in package.json `build` but stay dark until certificates are
// provisioned: electron-builder reads them from the environment and, when they are absent, packages
// unsigned. This hook makes that visible in the build log instead of leaving it to electron-builder's
// per-platform "skipped" lines.
//
//   macOS    CSC_LINK + CSC_KEY_PASSWORD (Developer ID Application .p12) sign; notarization needs
//            APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID, or APPLE_API_KEY +
//            APPLE_API_KEY_ID + APPLE_API_ISSUER
//   Windows  WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD (falls back to CSC_LINK + CSC_KEY_PASSWORD)
//   Linux    .deb packages are not code-signed

const has = (...names) => names.every((n) => !!process.env[n]);

function signingStatus(platform) {
  if (platform === 'darwin') {
    const signed = has('CSC_LINK', 'CSC_KEY_PASSWORD');
    const notarized =
      has('APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID') ||
      has('APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER');
    if (signed && notarized) return null;
    return `macOS package will be ${signed ? 'signed but NOT notarized' : 'UNSIGNED and NOT notarized'} (set CSC_LINK/CSC_KEY_PASSWORD and APPLE_* to sign and notarize)`;
  }
  if (platform === 'win32') {
    if (has('WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD') || has('CSC_LINK', 'CSC_KEY_PASSWORD')) return null;
    return 'Windows installer will be UNSIGNED (set WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD to sign)';
  }
  return 'Linux packages are not code-signed';
}

exports.default = async function signingNotice(context) {
  const notice = signingStatus(context.electronPlatformName);
  if (notice) console.log(`[signing] ${notice}`);
};
