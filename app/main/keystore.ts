import * as fs from 'fs';
import * as path from 'path';
import hive from '@hiveio/hive-js';
import { decryptKey, encryptKey, isEncrypted } from '../utils/keyEnvelope';

/**
 * Phase 3 · D9b Stage B (step 1) — the MAIN-PROCESS keystore.
 *
 * This module is ADDITIVE: nothing in the app imports it yet, so it cannot affect existing users. It
 * holds the same account records the renderer keeps in redux-persist localStorage, but in a
 * main-owned JSON file, and it performs the two operations that must eventually leave the renderer
 * entirely — signing and memo encode/decode — inside the main process, so a compromised renderer can
 * never read a WIF.
 *
 * Design decisions locked by the two-reviewer pass (2026-08):
 *  - Canonical at-rest is the password scrypt+AES-GCM v2 envelope (keyEnvelope.ts), stored VERBATIM.
 *    No Electron safeStorage layer in v1 — wrapping the only recoverable copy in an OS-keychain-bound
 *    blob would let a keychain reset / OS reinstall / machine move permanently lock out a user who
 *    still knows their password (a PARAMOUNT violation caused by the new design). safeStorage may be
 *    added later ONLY as an optional additive layer that falls back to the bare envelope.
 *  - Chain config (chain_id / address_prefix) lives in the renderer per selected node; main must be
 *    told it via setChainConfig() before signing or it will sign for the wrong chain. The renderer
 *    assembles the full unsigned tx (tapos + expiration); main only signs — see signTransaction().
 *  - list() returns metadata only (never key material). Records may be plaintext (encrypted===false),
 *    so decryption is gated on isEncrypted(), not on the stored flag alone.
 *
 * Session-unlock lifetime, the role gate recomputed from ops, and the native confirmation for
 * dangerous ops are Stage C — this module takes the password per call for now.
 */

export interface KeyRecord {
  account: string;
  key: string; // v2 envelope | legacy OpenSSL blob | plaintext WIF (when encrypted===false)
  encrypted: boolean;
  type: string; // authority role the key satisfies (active/posting/owner)
  memo?: string; // encrypted memo-key envelope | plaintext memo WIF
}

interface KeystoreFile {
  version: 1;
  accounts: Record<string, KeyRecord>;
}

/** Public metadata for list() — deliberately carries NO key/memo material. */
export interface AccountSummary {
  account: string;
  encrypted: boolean;
  type: string;
  hasMemo: boolean;
}

const EMPTY: KeystoreFile = { version: 1, accounts: {} };

export class Keystore {
  readonly filePath: string;

  private data: KeystoreFile;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = Keystore.read(filePath);
  }

  private static read(filePath: string): KeystoreFile {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1 && parsed.accounts && typeof parsed.accounts === 'object') {
        return parsed as KeystoreFile;
      }
    } catch {
      // missing/unreadable/corrupt -> start empty; callers never lose the renderer copy (dual-store).
    }
    return { version: 1, accounts: {} };
  }

  /** Atomic write: serialize to a temp file in the same dir, then rename over the target. */
  private persist(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }

  hasAccount(account: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.data.accounts, account);
  }

  /** Insert/replace a record verbatim (envelope ciphertext is copied as-is; never decrypted here). */
  putRecord(rec: KeyRecord): void {
    this.data.accounts[rec.account] = {
      account: rec.account,
      key: rec.key,
      encrypted: rec.encrypted,
      type: rec.type,
      ...(rec.memo !== undefined ? { memo: rec.memo } : {}),
    };
    this.persist();
  }

  removeAccount(account: string): void {
    if (this.hasAccount(account)) {
      delete this.data.accounts[account];
      this.persist();
    }
  }

  /**
   * The Stage B migration: a DUMB, IDEMPOTENT, CIPHERTEXT-ONLY copy. Insert any record whose account
   * is not already present; existing records are never overwritten (main-side wins, so re-running can
   * never clobber a newer value). Records are copied VERBATIM — nothing is decrypted, no password is
   * involved. Persists once for the whole batch. Returns which accounts were added vs already present.
   */
  migrateRecords(records: KeyRecord[]): { migrated: string[]; skipped: string[] } {
    const migrated: string[] = [];
    const skipped: string[] = [];
    for (const rec of records) {
      if (!rec || !rec.account || typeof rec.key !== 'string') continue;
      if (this.hasAccount(rec.account)) {
        skipped.push(rec.account);
        continue;
      }
      this.data.accounts[rec.account] = {
        account: rec.account,
        key: rec.key,
        encrypted: rec.encrypted,
        type: rec.type,
        ...(rec.memo !== undefined ? { memo: rec.memo } : {}),
      };
      migrated.push(rec.account);
    }
    if (migrated.length) this.persist();
    return { migrated, skipped };
  }

  /** Metadata only — no key/memo material ever crosses this boundary. */
  listAccounts(): AccountSummary[] {
    return Object.values(this.data.accounts)
      .map((r) => ({
        account: r.account,
        encrypted: r.encrypted,
        type: r.type,
        hasMemo: r.memo !== undefined,
      }))
      .sort((a, b) => a.account.localeCompare(b.account));
  }

  /**
   * Sync the chain parameters main signs against. The renderer owns node selection, so it must call
   * this (chain_id + address_prefix) before signing or main defaults to mainnet and produces
   * signatures for the wrong chain on Testnet/Mirrornet.
   */
  static setChainConfig(chainId: string, addressPrefix?: string): void {
    if (chainId) hive.config.set('chain_id', chainId);
    if (addressPrefix) hive.config.set('address_prefix', addressPrefix);
  }

  /** Decrypt the signing WIF for an account. Plaintext records return as-is; ciphertext is decrypted. */
  async decryptWif(account: string, password: string): Promise<string> {
    const rec = this.data.accounts[account];
    if (!rec) throw new Error(`no key for account ${account}`);
    return isEncrypted(rec.key) ? decryptKey(rec.key, password) : rec.key;
  }

  private async decryptMemoWif(account: string, password: string): Promise<string> {
    const rec = this.data.accounts[account];
    if (!rec || rec.memo === undefined) throw new Error(`no memo key for account ${account}`);
    return isEncrypted(rec.memo) ? decryptKey(rec.memo, password) : rec.memo;
  }

  /**
   * Sign a FULLY-FORMED transaction (renderer supplies operations + tapos + expiration). Main only
   * signs; it never assembles tapos. The WIF is derived, used, and dropped inside this call — it is
   * never returned. The key's role LABEL is cosmetic to hive.auth.signTransaction (it signs with the
   * value only), so a single-entry object is sufficient.
   */
  async signTransaction(preparedTx: any, account: string, password: string): Promise<any> {
    const wif = await this.decryptWif(account, password);
    const rec = this.data.accounts[account];
    return hive.auth.signTransaction(preparedTx, { [rec.type || 'active']: wif });
  }

  /** Encrypt an outgoing memo with the account's memo key (never exposes the memo WIF). */
  async encodeMemo(
    account: string,
    password: string,
    recipientPublicKey: string,
    message: string
  ): Promise<string> {
    const memoWif = await this.decryptMemoWif(account, password);
    return hive.memo.encode(memoWif, recipientPublicKey, message);
  }

  /** Decrypt an incoming memo with the account's memo key. */
  async decodeMemo(account: string, password: string, encoded: string): Promise<string> {
    const memoWif = await this.decryptMemoWif(account, password);
    return hive.memo.decode(memoWif, encoded);
  }

  /**
   * Import a WIF straight into main custody: the plaintext WIF enters main, is encrypted under the
   * wallet password, and only the envelope is persisted. Used by the Stage B renderer refactor so a
   * newly added key never lands in the redux keys slice (which redux-persist would write to disk).
   */
  async importKey(account: string, wif: string, password: string, type: string): Promise<void> {
    const envelope = await encryptKey(wif, password);
    this.putRecord({ account, key: envelope, encrypted: true, type });
  }
}
