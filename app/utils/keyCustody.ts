import type { KeystoreBridge } from '../preload';

/**
 * Where an encrypted key is unlocked: in the main process or in this renderer.
 *
 * Every Electron window (the app window and the sign window) gets the preload's keystore bridge, and
 * every encrypted record the renderer holds is in main custody: rehydration copies it into main
 * (keystoreMainMigration), imports go straight to main (`keystore:importKey`), and an unlock self-heals
 * a missing/stale main record by pushing the ciphertext. So whenever the bridge exists, unlock, sign,
 * memo encode and memo-key binding run in main only, with no renderer-side fallback, and no WIF of a
 * stored record ever reaches the renderer.
 *
 * The LOCAL path (DecryptModal without `onVerify`, Send's local memo encode, the local branches of
 * actions/keys.ts and broadcast.signTx) runs only when there is NO bridge: the renderer bundle served
 * outside Electron (`vite` preview in a browser) and unit tests. There is no main process to hold the
 * key there, so the renderer decrypts its own ciphertext.
 *
 * Plaintext records (`encrypted: false`, written by pre-2026 releases without a password) still sign
 * from the renderer's copy: that WIF is already stored in the clear in the renderer's storage, so main
 * custody would protect nothing until the user upgrades it to an encrypted record.
 */
export function mainKeystore(): KeystoreBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electronAPI?: { keystore?: KeystoreBridge } }).electronAPI?.keystore;
}
