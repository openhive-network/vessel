/**
 * Pure parser for the `hive://sign` / `vessel://sign` deep link — extracted from `main.dev.ts`'s
 * `createPrompt` so the money-path can be unit-tested without launching Electron (Phase 6).
 *
 * The renderer sign flow expects `?type=sign&action=promptOperation&ops=<b64>&meta=<b64>`; this turns
 * the incoming custom-scheme URI into those two base64 payloads. It uses the native `URL` (the Phase 6
 * `url-parse` replacement): `pathname`/`hash` are byte-identical to `url-parse` for these payloads
 * (standard base64 with `+` `/` `=`), and the `host` is lower-cased to preserve url-parse's
 * case-insensitive authority matching. A malformed or non-`sign` URI returns null (no-op), matching
 * the prior lenient behavior.
 */

// The `ops` base64 rides in the path segment after `/tx/`; `meta` (optional) rides in the fragment.
const OPS_RE = /\/tx\/((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)/;
const META_RE = /^#((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/;
const EMPTY_META = 'e30='; // base64('{}')

export interface SignRequest {
  ops: string;
  meta: string;
}

export function parseSignRequest(uri: string): SignRequest | null {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return null;
  }
  // url-parse lowercased the authority; native URL does NOT for non-special schemes (hive:/vessel:),
  // so normalize to keep case-insensitive host matching (e.g. hive://SIGN/tx/...).
  if (parsed.host.toLowerCase() !== 'sign') return null;
  const match = OPS_RE.exec(parsed.pathname);
  if (!match) return null;
  const metamatch = META_RE.exec(parsed.hash);
  return { ops: match[1], meta: metamatch ? metamatch[1] : EMPTY_META };
}
