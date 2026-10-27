/**
 * Load a local .env into process.env for tests (zero-dep — Node's built-in loader). Used by the opt-in
 * testnetBroadcast smoke to pick up VESSEL_TESTNET_NODE / _ACCOUNT / _WIF without exporting them by
 * hand. .env is gitignored; never commit a key. A missing .env is fine — the smoke just stays skipped.
 */
try {
  (process as any).loadEnvFile('.env');
} catch {
  // no .env present (the normal case) — env-gated tests stay skipped
}
