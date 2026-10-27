/**
 * Shared crypto error types. Kept in their own module so `keyEnvelope` and `legacyAesDecrypt` can
 * both import them without an import cycle (spec §4.3). Pure — no legacy imports.
 */

/** Authentication failure: wrong password, GCM tag mismatch, bad CBC padding, or non-UTF-8 result. */
export class WrongPasswordError extends Error {}

/** Structural failure: input is neither a valid v2 envelope nor a legacy OpenSSL blob. */
export class InvalidCiphertextError extends Error {}
