// @flow
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as KeysActions from '../actions/keys';
import DecryptModal from '../components/DecryptModal';
import { encryptKey, isEncrypted, needsReencrypt } from '../utils/keyEnvelope';

/**
 * §7.2 — the redux-driven unlock prompt. It owns none of the crypto UI: the shared `DecryptModal`
 * captures the password and decrypts `auth.key`; this container performs the field-aware lazy
 * re-encrypt and re-issues the operation with a FRESH local auth carrying the cleartext WIF.
 *
 * The decrypted WIF (and the password) exist ONLY inside `handleDecrypted`'s scope. The props
 * `auth` object is NEVER mutated (mutating it was the old cleartext-at-rest leak, §6a).
 */
class DecryptPrompt extends Component {
  handleDecrypted = async (wif: string, password: string) => {
    const { operation, params, auth } = this.props.keys.decrypt;

    // ---- lazy re-encrypt (Task 2 / §7.2), under the just-verified password ----
    const reenc = {};
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

    // ---- proceed with the operation; cleartext WIF lives ONLY in this local object ----
    const localAuth = { ...auth, encrypted: false, key: wif };
    this.props.actions.useKey(operation, params, localAuth);
    this.props.actions.useKeyRequestDecryptClose();
  };

  handleCancel = () => {
    this.props.actions.useKeyRequestDecryptClose();
  };

  render() {
    const { decrypt } = this.props.keys;
    if (!decrypt || !decrypt.auth) return null;
    return (
      <DecryptModal
        ciphertext={decrypt.auth.key}
        header="Decrypt Wallet to Broadcast Transaction"
        onDecrypted={this.handleDecrypted}
        onCancel={this.handleCancel}
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
      },
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(DecryptPrompt);
