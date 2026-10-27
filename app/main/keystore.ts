import * as fs from 'fs';
import * as path from 'path';
import { hiveTx, hiveAuth, hiveMemo, hiveConfig } from '../utils/hiveApi';
import {
  decryptKey,
  encryptKey,
  isEncrypted,
  needsReencrypt,
  WrongPasswordError,
} from '../utils/keyEnvelope';
import { requiredRoleForOps, keySatisfiesRole } from '../utils/authorityRoles';

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
 *
 * Lazy upgrade: records arrive verbatim, so a migrated wallet holds the shipped crypto-js ciphertext
 * (OpenSSL MD5, one iteration). The first successful unlock in main — verify, sign, or a memo
 * encode/decode — re-encrypts that record's legacy / below-default-N fields (and a plaintext memo next
 * to an encrypted key) into a v2 envelope under the password that just unlocked it, checks the new
 * envelope decrypts back, and only then overwrites the record. The renderer then adopts the envelope
 * via getEnvelope() and drops its own legacy copies. Legacy decrypt stays permanent, so a record that
 * never reached main still unlocks.
 */

/** The ciphertext of a record, for the renderer to mirror. Never carries a plaintext key. */
export interface RecordEnvelope {
  key?: string;
  memo?: string;
}

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

/** A v2 envelope at the current scrypt parameters (no lazy upgrade pending). */
const isCurrent = (s: string): boolean => isEncrypted(s) && !needsReencrypt(s);

/** Encrypt `wif` into a v2 envelope and prove it decrypts back before anyone relies on it. */
async function sealVerified(wif: string, password: string): Promise<string> {
  const envelope = await encryptKey(wif, password);
  if ((await decryptKey(envelope, password)) !== wif) throw new Error('re-encrypted envelope does not round-trip');
  return envelope;
}

/** The memo WIF behind `memo`, or null when it is not unlocked by the wallet password. */
async function unlockMemo(memo: string, password: string, known?: string): Promise<string | null> {
  if (known !== undefined) return known;
  if (!isEncrypted(memo)) return hiveAuth.isWif(memo) ? memo : null;
  try {
    const wif = await decryptKey(memo, password);
    return hiveAuth.isWif(wif) ? wif : null;
  } catch (e) {
    if (e instanceof WrongPasswordError) return null;
    throw e;
  }
}

// Reserved JS object keys a hostile renderer could send to corrupt the account map — never store them.
const UNSAFE_ACCOUNT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isUnsafeAccount = (account: string): boolean => UNSAFE_ACCOUNT_KEYS.has(account);

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

  /**
   * Atomic durable write: write to a temp file, fsync it to disk, then rename over the target (rename
   * is atomic on POSIX). The fsync matters once main becomes the authoritative custody store — without
   * it a power-loss between write and rename could leave a torn/zero-length keystore, i.e. key loss.
   */
  private persist(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    const fd = fs.openSync(tmp, 'w', 0o600);
    try {
      fs.writeSync(fd, JSON.stringify(this.data));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, this.filePath);
  }

  hasAccount(account: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.data.accounts, account);
  }

  /** Insert/replace a record verbatim (envelope ciphertext is copied as-is; never decrypted here). */
  putRecord(rec: KeyRecord): void {
    if (isUnsafeAccount(rec.account)) throw new Error('unsafe account name');
    this.data.accounts[rec.account] = {
      account: rec.account,
      key: rec.key,
      encrypted: rec.encrypted,
      type: rec.type,
      ...(rec.memo !== undefined ? { memo: rec.memo } : {}),
    };
    this.persist();
  }

  /**
   * D9b Stage B4 — overwrite-allowed sync of ONE record from the renderer's localStorage into main.
   * Unlike migrateRecords (insert-if-absent, main-wins) this REPLACES an existing record. The renderer's
   * unlock self-heal relies on it: if main is missing an account or holds a stale envelope (e.g. the
   * wallet password was changed by re-importing the key after migration), the renderer re-pushes the
   * envelope it holds so main can then verify/sign. Ciphertext ONLY — it refuses a plaintext or
   * non-envelope key so a compromised renderer can never stash a bare WIF in the keystore file. No
   * password, no decrypt. (localStorage is never staler than main under the dual store, so pushing
   * localStorage -> main is monotonic and cannot regress a newer main record.)
   */
  putEnvelope(rec: KeyRecord): void {
    if (isUnsafeAccount(rec.account)) throw new Error('unsafe account name');
    if (typeof rec.key !== 'string' || !isEncrypted(rec.key)) {
      throw new Error('putEnvelope requires an encrypted envelope');
    }
    // Never let a renderer copy that predates a main-side upgrade put the weak ciphertext back.
    const current = this.data.accounts[rec.account];
    if (current && current.encrypted && isCurrent(current.key) && !isCurrent(rec.key)) {
      throw new Error('putEnvelope refuses to replace a current envelope with a weaker one');
    }
    this.putRecord({ ...rec, encrypted: true });
  }

  /**
   * The record's ciphertext, so the renderer can replace its own (legacy) copy after an upgrade. Only
   * encrypted fields are returned: a plaintext key or memo is omitted. Null for an unknown account.
   */
  getEnvelope(account: string): RecordEnvelope | null {
    const rec = this.data.accounts[account];
    if (!rec) return null;
    return {
      ...(rec.encrypted && isEncrypted(rec.key) ? { key: rec.key } : {}),
      ...(rec.memo !== undefined && isEncrypted(rec.memo) ? { memo: rec.memo } : {}),
    };
  }

  removeAccount(account: string): void {
    if (this.hasAccount(account)) {
      delete this.data.accounts[account];
      this.persist();
    }
  }

  /**
   * Reconcile against the renderer's removal tombstones: delete any tombstoned account still present in
   * main. Without this, an account removed after it was migrated would linger in keystore.json and
   * resurrect once main becomes authoritative. Persists once for the batch; returns what was removed.
   */
  pruneAccounts(accounts: string[]): string[] {
    const removed: string[] = [];
    for (const account of accounts) {
      if (this.hasAccount(account)) {
        delete this.data.accounts[account];
        removed.push(account);
      }
    }
    if (removed.length) this.persist();
    return removed;
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
      if (!rec || !rec.account || typeof rec.key !== 'string' || isUnsafeAccount(rec.account)) continue;
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
    if (chainId) hiveConfig.set('chain_id', chainId);
    if (addressPrefix) hiveConfig.set('address_prefix', addressPrefix);
  }

  /**
   * D9b Stage B4 — validate a password against an account's stored envelope WITHOUT returning any key
   * material. The renderer's unlock modal calls this (per debounced keystroke) to gate its Unlock
   * button for main-custody accounts, so it can confirm the password unlocks the key while the WIF
   * stays inside main. Returns true iff the password decrypts to a valid WIF. A wrong password (or an
   * unknown account) returns false rather than throwing, so the modal shows a disabled button, not an
   * error; corrupt ciphertext and other faults propagate (the IPC layer sanitizes them to a code).
   */
  async verify(account: string, password: string): Promise<boolean> {
    const rec = this.data.accounts[account];
    if (!rec) return false;
    let wif: string;
    try {
      wif = isEncrypted(rec.key) ? await decryptKey(rec.key, password) : rec.key;
    } catch (e) {
      if (e instanceof WrongPasswordError) return false;
      throw e;
    }
    if (!hiveAuth.isWif(wif)) return false;
    await this.upgradeRecord(rec, password, { key: wif });
    return true;
  }

  /** Decrypt the signing WIF for an account. Plaintext records return as-is; ciphertext is decrypted. */
  async decryptWif(account: string, password: string): Promise<string> {
    const rec = this.data.accounts[account];
    if (!rec) throw new Error(`no key for account ${account}`);
    const wif = isEncrypted(rec.key) ? await decryptKey(rec.key, password) : rec.key;
    if (hiveAuth.isWif(wif)) await this.upgradeRecord(rec, password, { key: wif });
    return wif;
  }

  private async decryptMemoWif(account: string, password: string): Promise<string> {
    const rec = this.data.accounts[account];
    if (!rec || rec.memo === undefined) throw new Error(`no memo key for account ${account}`);
    const memoWif = isEncrypted(rec.memo) ? await decryptKey(rec.memo, password) : rec.memo;
    if (hiveAuth.isWif(memoWif)) await this.upgradeRecord(rec, password, { memo: memoWif });
    return memoWif;
  }

  /**
   * Re-encrypt `rec`'s weak fields under `password`, which has just unlocked it. `unlocked` holds the
   * cleartext the caller already has; a stale memo the caller did not decrypt is decrypted here (the
   * memo shares the wallet password, C6) and left alone if it does not. Plaintext main keys
   * (encrypted===false) are not touched: they were stored without a password.
   *
   * The upgrade is best-effort: the caller's unlock has already succeeded and the old ciphertext still
   * decrypts, so a failure is logged (code only) and retried on the next unlock rather than failing it.
   */
  private async upgradeRecord(
    rec: KeyRecord,
    password: string,
    unlocked: { key?: string; memo?: string }
  ): Promise<void> {
    if (!rec.encrypted) return;
    const keyStale = needsReencrypt(rec.key);
    const memoStale = rec.memo !== undefined && (needsReencrypt(rec.memo) || !isEncrypted(rec.memo));
    if (!keyStale && !memoStale) return;
    try {
      const next: KeyRecord = { ...rec };
      if (keyStale) {
        const wif = unlocked.key ?? (await decryptKey(rec.key, password));
        next.key = await sealVerified(wif, password);
      }
      if (memoStale && rec.memo !== undefined) {
        const memoWif = await unlockMemo(rec.memo, password, unlocked.memo);
        if (memoWif !== null) next.memo = await sealVerified(memoWif, password);
      }
      // A concurrent putEnvelope/remove replaced the record while we worked: keep theirs.
      if (this.data.accounts[rec.account] !== rec) return;
      if (next.key === rec.key && next.memo === rec.memo) return;
      this.data.accounts[rec.account] = next;
      this.persist();
       
      console.log(`[keystore] re-encrypted @${rec.account} into a v2 envelope`);
    } catch (e) {
      // Only an fs errno code (or a generic marker) is logged — never a message that could carry a key.
      const code = (e as NodeJS.ErrnoException)?.code ?? 'error';
       
      console.error(`[keystore] re-encrypt of @${rec.account} deferred: ${code}`);
    }
  }

  /**
   * Sign a FULLY-FORMED transaction (renderer supplies operations + tapos + expiration). Main only
   * signs; it never assembles tapos. The WIF is derived, used, and dropped inside this call — it is
   * never returned. The key's role LABEL is cosmetic to the facade's signTransaction (it signs with the
   * value only), so a single-entry object is sufficient. Signature is non-deterministic (hive-tx, F1).
   */
  async signTransaction(preparedTx: any, account: string, password: string): Promise<any> {
    const rec = this.data.accounts[account];
    if (!rec) throw new Error(`no key for account ${account}`);

    // D9b Stage C — recompute the HF28 authority gate IN MAIN, from the ACTUAL operations in the tx, so
    // a compromised renderer cannot get main to sign an operation the stored key is not authorized for
    // (e.g. an `active` transfer signed with a `posting` key). This mirrors the renderer's gate
    // (authorityRoles) but trusts only the ops present in the tx, never a renderer-supplied role. The
    // renderer never persists the optional capability object, so its gate also decides on `type` alone —
    // this main-side check is therefore a faithful mirror and cannot reject an op the renderer allowed.
    // requiredRoleForOps throws on an empty tx or a posting+active/owner mix (both rejected client-side
    // already); letting them throw here fails closed. The gate runs BEFORE decryption — an unauthorized
    // request never even unlocks the key.
    const ops = Array.isArray(preparedTx?.operations) ? preparedTx.operations : [];
    const { role } = requiredRoleForOps(ops);
    if (!keySatisfiesRole(rec.type, role)) {
      throw new Error(
        `stored ${rec.type} key for @${account} cannot satisfy the required ${role} authority`
      );
    }

    const wif = await this.decryptWif(account, password);
    return hiveTx.signTransaction(preparedTx, { [rec.type || 'active']: wif });
  }

  /**
   * Encrypt an outgoing memo with the account's memo key (never exposes the memo WIF). If
   * `expectedSenderMemoPublic` is supplied (the account's on-chain memo_key), the stored memo key must
   * still derive to it — this preserves the renderer's pre-B4-2b guard that refused to encode with a
   * rotated/stale memo key (which the recipient could not decrypt), now enforced in main where the WIF
   * lives instead of the renderer.
   */
  async encodeMemo(
    account: string,
    password: string,
    recipientPublicKey: string,
    message: string,
    expectedSenderMemoPublic?: string
  ): Promise<string> {
    const memoWif = await this.decryptMemoWif(account, password);
    if (expectedSenderMemoPublic && hiveAuth.wifToPublic(memoWif) !== expectedSenderMemoPublic) {
      throw new Error('stored memo key does not match the account memo key on chain');
    }
    return hiveMemo.encode(memoWif, recipientPublicKey, message);
  }

  /** Decrypt an incoming memo with the account's memo key. */
  async decodeMemo(account: string, password: string, encoded: string): Promise<string> {
    const memoWif = await this.decryptMemoWif(account, password);
    return hiveMemo.decode(memoWif, encoded);
  }

  /**
   * Bind a memo key to an account held in main (C6: the memo shares the wallet password). The password
   * must unlock the account's encrypted main key; the memo WIF is then stored as a v2 envelope. Throws
   * WrongPasswordError for a password that does not unlock the main key, and refuses a plaintext main
   * key (there is no password to bind the memo to) or an invalid WIF.
   */
  async importMemoKey(account: string, memoWif: string, password: string): Promise<void> {
    const rec = this.data.accounts[account];
    if (!rec) throw new Error(`no key for account ${account}`);
    if (!rec.encrypted || !isEncrypted(rec.key)) throw new Error('memo key requires an encrypted main key');
    if (!hiveAuth.isWif(memoWif)) throw new Error('invalid wif');
    if (!(await this.verify(account, password))) throw new WrongPasswordError('password does not unlock the key');
    // verify() may have just upgraded the record; bind the memo to whatever it holds now.
    this.putRecord({ ...this.data.accounts[account], memo: await encryptKey(memoWif, password) });
  }

  /**
   * Import a WIF straight into main custody: the plaintext WIF enters main, is encrypted under the
   * wallet password, and only the envelope is persisted. Used by the Stage B renderer refactor so a
   * newly added key never lands in the redux keys slice (which redux-persist would write to disk).
   */
  async importKey(account: string, wif: string, password: string, type: string): Promise<void> {
    if (isUnsafeAccount(account)) throw new Error('unsafe account name');
    // Refuse to clobber an existing record — a re-encrypt/rotate is a separate, explicit path. Under
    // the D9b threat model a hostile renderer with the password must not be able to overwrite a key.
    if (this.hasAccount(account)) throw new Error('account already exists');
    if (!hiveAuth.isWif(wif)) throw new Error('invalid wif');
    const envelope = await encryptKey(wif, password);
    this.putRecord({ account, key: envelope, encrypted: true, type });
  }
}
