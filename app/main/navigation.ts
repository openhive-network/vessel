/**
 * The `will-navigate` policy for the app's windows, kept free of Electron so it can be unit-tested.
 *
 * A window may only navigate to the app's own renderer entry: in production that is exactly the
 * `file:` URL of out/renderer/index.html (any query/fragment — the sign window rides its params on the
 * query, the router on the fragment); under `electron-vite dev` (ELECTRON_RENDERER_URL set) it is the
 * dev server's origin instead. Prefix matching (`startsWith('http://localhost')`) is NOT used: it lets
 * `http://localhost.evil.example` and every other local file through.
 */
export interface NavigationPolicy {
  /** The production renderer entry, a `file:` URL. */
  rendererEntry: string;
  /** The electron-vite dev server URL (ELECTRON_RENDERER_URL); unset in production. */
  devServerUrl?: string;
}

const parse = (url: string): URL | null => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

export function isAllowedNavigation(url: string, policy: NavigationPolicy): boolean {
  const target = parse(url);
  if (!target) return false;

  if (policy.devServerUrl) {
    const dev = parse(policy.devServerUrl);
    return dev !== null && (dev.protocol === 'http:' || dev.protocol === 'https:') && target.origin === dev.origin;
  }

  const entry = parse(policy.rendererEntry);
  return (
    entry !== null &&
    entry.protocol === 'file:' &&
    target.protocol === 'file:' &&
    target.host === entry.host &&
    target.pathname === entry.pathname
  );
}
