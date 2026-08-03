/**
 * Phase 3 · Task 5 — validation of the UNTRUSTED operations payload carried by a `vessel://sign` /
 * `hive://sign` URI. The sign window renders whatever a third party puts in the URL, so the decoded
 * `ops` must be structurally validated and bounded BEFORE it is displayed, edited, or signed. Pure (no
 * DOM) so it is unit-tested directly.
 *
 * Deliberately NOT an operation-name allowlist: Vessel is a general-purpose signer and legitimately
 * signs op types it has no rich display for (they render as "review the JSON"). Over-restricting names
 * here would break valid requests. We validate SHAPE and SIZE only; the authority gate
 * (requiredRoleForOps, enforced in BOTH the renderer and the main-process keystore) governs what a
 * given key is actually allowed to sign.
 */

// A legitimate sign request is a handful of operations; a very large count indicates abuse/DoS.
export const MAX_SIGN_OPS = 50;
// Cap the encoded payload so a giant URL cannot exhaust memory before/at JSON.parse.
export const MAX_SIGN_PAYLOAD_B64_LEN = 256 * 1024; // 256 KB of base64

export type SignOp = [string, Record<string, any>];
export interface SignOpsResult {
  ok: boolean;
  ops: SignOp[];
  error?: string;
}

function decodeBase64(b64: string): string {
  if (typeof atob === 'function') return atob(b64); // browser + Node ≥16
  return Buffer.from(b64, 'base64').toString('binary'); // non-browser fallback
}

/**
 * Decode + validate the base64 `ops` query param from a sign URI. Returns the parsed operations when
 * the payload is a well-formed, bounded array of `[opName, params]` tuples; otherwise a user-facing
 * error and an empty ops list. Never throws.
 */
export function parseAndValidateSignOps(opsBase64: unknown): SignOpsResult {
  if (typeof opsBase64 !== 'string' || opsBase64.length === 0) {
    return { ok: false, ops: [], error: 'This signing request contains no operations.' };
  }
  if (opsBase64.length > MAX_SIGN_PAYLOAD_B64_LEN) {
    return { ok: false, ops: [], error: 'This signing request is too large to process safely.' };
  }
  let decoded: string;
  try {
    decoded = decodeBase64(opsBase64);
  } catch {
    return { ok: false, ops: [], error: 'This signing request is malformed (bad encoding).' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return { ok: false, ops: [], error: 'This signing request is malformed (invalid JSON).' };
  }
  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      ops: [],
      error: 'This signing request is malformed (expected a list of operations).',
    };
  }
  if (parsed.length === 0) {
    return { ok: false, ops: [], error: 'This signing request contains no operations.' };
  }
  if (parsed.length > MAX_SIGN_OPS) {
    return {
      ok: false,
      ops: [],
      error: `This signing request has too many operations (limit ${MAX_SIGN_OPS}).`,
    };
  }
  for (let i = 0; i < parsed.length; i += 1) {
    const op = parsed[i];
    if (
      !Array.isArray(op) ||
      op.length !== 2 ||
      typeof op[0] !== 'string' ||
      op[0].length === 0 ||
      typeof op[1] !== 'object' ||
      op[1] === null ||
      Array.isArray(op[1])
    ) {
      return { ok: false, ops: [], error: `Operation ${i + 1} in this request is malformed.` };
    }
  }
  return { ok: true, ops: parsed as SignOp[] };
}
