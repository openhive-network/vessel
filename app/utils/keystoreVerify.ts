/**
 * Phase 3 · Task 5 — verify a wallet password against the MAIN-process keystore for the sign window's
 * confirm-and-sign modal. Self-heals a stale/missing main record exactly like DecryptPrompt does (push
 * the renderer's current ciphertext envelope, then re-verify), so a re-imported/never-migrated account
 * still unlocks. Returns a boolean — the WIF never enters the renderer. Returns false outside Electron
 * (no bridge).
 */
export interface KeyRecordLike {
  account: string;
  key: string;
  encrypted?: boolean;
  type: string;
  memo?: string;
}

export async function verifyPasswordInMain(
  record: KeyRecordLike,
  password: string
): Promise<boolean> {
  const api = typeof window !== 'undefined' ? (window as any).electronAPI?.keystore : undefined;
  if (!api || !record || !record.account) return false;
  try {
    if (await api.verify(record.account, password)) return true;
  } catch {
    // fall through to the self-heal
  }
  try {
    await api.putEnvelope({
      account: record.account,
      key: record.key,
      encrypted: true,
      type: record.type,
      ...(record.memo !== undefined ? { memo: record.memo } : {}),
    });
    return await api.verify(record.account, password);
  } catch {
    return false;
  }
}
