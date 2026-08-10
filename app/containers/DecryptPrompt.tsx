import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as KeysActions from '../actions/keys';
import DecryptModal from '../components/DecryptModal';
import { encryptKey, isEncrypted, needsReencrypt } from '../utils/keyEnvelope';

/**
 * §7.2 — the redux-driven unlock prompt. It owns none of the crypto UI: the shared `DecryptModal`
 * captures the password and gates its Unlock button; this container re-issues the operation with a
 * FRESH local auth carrying the signing credential.
 *
 * Two paths (D9b Stage B4-2), selected by whether the main-process keystore bridge exists:
 *  - REMOTE (Electron, `window.electronAPI.keystore` present): the WIF NEVER enters the renderer.
 *    `handleVerify` validates the password against main and self-heals a stale/missing record; the
 *    signer is `{ account, password }` (no key material) and signing happens in the main process.
 *  - LOCAL (non-Electron): the modal decrypts `auth.key`; this container performs the field-aware
 *    lazy re-encrypt and signs with the cleartext WIF, exactly as before.
 *
 * The props `auth` object is NEVER mutated (mutating it was the old cleartext-at-rest leak, §6a).
 */
class DecryptPrompt extends Component<any, any> {
  // The ciphertext envelope last pushed into main by the self-heal, so a stale/missing record is
  // repaired at most once per distinct envelope (not on every failed keystroke probe).
  syncedKey = null;

  // REMOTE probe: validate the password against the main-process keystore (returns a boolean; the WIF
  // stays in main). If main can't validate — the record is missing (migration gap) or stale (the wallet
  // password was changed by re-importing after migration) — push the renderer's current ciphertext
  // envelope into main ONCE, then re-check. localStorage is never staler than main under the dual store,
  // so this only repairs main forward, and only the envelope (never a WIF) crosses the boundary.
  handleVerify = async (password) => {
    const { auth } = this.props.keys.decrypt;
    const keystore = window.electronAPI && window.electronAPI.keystore;
    if (!keystore) return false;
    let ok = false;
    try {
      ok = await keystore.verify(auth.account, password);
    } catch (e) {
      ok = false;
    }
    if (!ok && this.syncedKey !== auth.key) {
      this.syncedKey = auth.key;
      try {
        await keystore.putEnvelope({
          account: auth.account,
          key: auth.key,
          encrypted: true,
          type: auth.type,
          ...(auth.memo !== undefined ? { memo: auth.memo } : {}),
        });
        ok = await keystore.verify(auth.account, password);
      } catch (e) {
        ok = false;
      }
    }
    return ok;
  };

  handleDecrypted = async (wif, password) => {
    const { operation, params, auth } = this.props.keys.decrypt;

    let signer;
    if (wif == null) {
      // REMOTE: the WIF never materialized in the renderer. Sign in main with an isolated signer that
      // carries no key material; broadcast.ts routes it to main with no local fallback. `handleVerify`
      // already synced main to the current envelope, so main can decrypt. No renderer-side lazy
      // re-encrypt — envelope/format upgrades for main-custody keys belong in the main process.
      signer = { account: auth.account, password };
    } else {
      // LOCAL: the modal decrypted the WIF. Field-aware lazy re-encrypt under the just-verified
      // password, then sign locally with the cleartext WIF.
      const reenc: any = {};
      if (needsReencrypt(auth.key)) {
        reenc.key = await encryptKey(wif, password);
      }
      if (auth.memo && !isEncrypted(auth.memo)) {
        // legacy plaintext memo -> upgrade to a v2 envelope bound to the same password
        reenc.memo = await encryptKey(auth.memo, password);
      }
      if (reenc.key || reenc.memo) {
        this.props.actions.keyReencrypted({ account: auth.account, ...reenc });
      }
      signer = wif;
    }

    const localAuth = { ...auth, encrypted: false, key: signer };
    this.props.actions.useKey(operation, params, localAuth);
    this.props.actions.useKeyRequestDecryptClose();
  };

  handleCancel = () => {
    this.props.actions.useKeyRequestDecryptClose();
  };

  render() {
    const { decrypt } = this.props.keys;
    if (!decrypt || !decrypt.auth) return null;
    const remote = !!(
      typeof window !== 'undefined' &&
      window.electronAPI &&
      window.electronAPI.keystore
    );
    return (
      <DecryptModal
        ciphertext={decrypt.auth.key}
        header="Decrypt Wallet to Broadcast Transaction"
        onDecrypted={this.handleDecrypted}
        onCancel={this.handleCancel}
        onVerify={remote ? this.handleVerify : undefined}
      />
    );
  }
}

function mapStateToProps(state) {
  return {
    keys: state.keys,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(
      {
        ...KeysActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(DecryptPrompt);
