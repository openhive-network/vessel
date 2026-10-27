import { createTransform } from 'redux-persist';

/**
 * Phase 1 · Task 4 (§6b) — persist ONLY the durable keys-slice fields; ephemeral UI/flow state
 * (`decrypt`, `confirm`, `addPrompt`, `lastError`, …) never reaches storage. Even if a future bug
 * parks a secret in an ephemeral keys-slice field, it cannot be serialized. Outbound is pass-through.
 *
 * The persisted shape is exactly `{names, permissions, isUser, removedLegacy}` — a strict subset of
 * what the shipped app persisted; old readers rehydrate it fine (I-2). `removedLegacy` (the removal
 * tombstone, 13.3) MUST be in this allowlist or a removed legacy account resurrects on next launch.
 */
 
type KeysSlice = any;

export const keysSurfaceTransform = createTransform<KeysSlice, KeysSlice>(
  (inbound) => ({
    names: Array.isArray(inbound?.names) ? inbound.names : [],
    permissions:
      inbound?.permissions && typeof inbound.permissions === 'object' ? inbound.permissions : {},
    isUser: !!inbound?.isUser,
    removedLegacy: Array.isArray(inbound?.removedLegacy) ? inbound.removedLegacy : [],
  }),
  (outbound) => outbound,
  { whitelist: ['keys'] },
);
