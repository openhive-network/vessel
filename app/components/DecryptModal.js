// @flow
import React, { Component } from 'react';
import { Message, Modal, Segment } from 'semantic-ui-react';
import { Form, Input } from 'formsy-semantic-ui-react';
import hive from '@hiveio/hive-js';

import { decryptKey, WrongPasswordError } from '../utils/keyEnvelope';

/**
 * §7.3 — the single password-unlock modal, shared by the redux-driven `DecryptPrompt` container
 * and by `Send`'s memo-decrypt path. It captures the password, decrypts ONE ciphertext, validates
 * the result is a WIF, then hands the cleartext WIF (plus the entered password, which the caller
 * needs to lazily re-encrypt) to `onDecrypted` — NEVER through redux.
 *
 * Live button feedback (restores the pre-2026 UX): the Unlock button enables only once the typed
 * password actually decrypts the ciphertext. The probe is DEBOUNCED (250 ms) and format-aware —
 * effectively instant for legacy crypto-js keys, one scrypt attempt per typing pause for v2
 * envelopes — never one decryption per keystroke.
 *
 * Security invariants:
 *  - The probe WIF (live check) and the real WIF (submit) live ONLY inside a local scope and are
 *    discarded as it returns; neither is stored in state or passed through redux.
 *  - The local live check is no weaker than the encrypted blob already on disk (offline
 *    brute-forceable regardless), so validating client-side leaks nothing new.
 *  - On a wrong password the password is CLEARED from component state (spec C8 / §6).
 *
 * Props: { ciphertext, header, onDecrypted(wif, password), onCancel }.
 * `onDecrypted` may be async (it performs the field-aware lazy re-encrypt in the caller); the modal
 * stays busy until it settles so any failure surfaces here.
 */
const DEBOUNCE_MS = 250;

export default class DecryptModal extends Component {
  constructor(props) {
    super(props);
    this.state = { password: '', busy: false, error: null, valid: false, checking: false };
    this.mounted = true;
    this.checkToken = 0;
    this.debounce = null;
  }

  componentWillUnmount() {
    this.mounted = false;
    if (this.debounce) clearTimeout(this.debounce);
  }

  handlePasswordChange = (e: SyntheticEvent, { value }: { value: string }) => {
    // Track the input, drop any prior error/validity, then (debounced) probe whether it decrypts.
    this.setState({ password: value, error: null, valid: false });
    if (this.debounce) clearTimeout(this.debounce);
    if (!value) {
      this.setState({ checking: false });
      return;
    }
    this.debounce = setTimeout(() => this.validate(value), DEBOUNCE_MS);
  };

  validate = async (candidate: string) => {
    const token = (this.checkToken += 1);
    const { ciphertext } = this.props;
    this.setState({ checking: true });
    let ok = false;
    try {
      const wif = await decryptKey(ciphertext, candidate);
      ok = hive.auth.isWif(wif); // probe WIF is discarded as this scope returns
    } catch (err) {
      ok = false;
    }
    // Ignore stale probes (the user kept typing) and post-unmount updates.
    if (!this.mounted || token !== this.checkToken) return;
    this.setState({ valid: ok, checking: false });
  };

  handleKeyUp = (e: SyntheticEvent) => {
    if (e.key === 'Enter' && this.state.valid && !this.state.busy) {
      this.handleSubmit(e);
    }
  };

  handleSubmit = async (e: SyntheticEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    const { password, busy, valid } = this.state;
    if (!password || busy || !valid) return;
    const { ciphertext, onDecrypted } = this.props;
    this.setState({ busy: true, error: null });
    try {
      // The decrypted WIF is scoped to this function; it is passed to onDecrypted and never stored.
      const wif = await decryptKey(ciphertext, password);
      if (!hive.auth.isWif(wif)) throw new WrongPasswordError();
      await onDecrypted(wif, password);
      if (this.mounted) this.setState({ password: '', busy: false, error: null, valid: false });
    } catch (err) {
      if (this.mounted) {
        this.setState({
          busy: false,
          password: '', // clear the password on any failure (C8)
          valid: false,
          error:
            err instanceof WrongPasswordError
              ? 'Incorrect password.'
              : 'Unable to decrypt this key.',
        });
      }
    }
  };

  render() {
    const { header, onCancel } = this.props;
    const { password, busy, error, valid, checking } = this.state;
    return (
      <Modal
        size="small"
        open
        header={header}
        content={
          <Segment padded basic loading={busy}>
            <p>
              This key is encrypted locally. Enter your wallet password to unlock it and continue.
            </p>
            <Form>
              <Input
                name="password"
                type="password"
                fluid
                focus
                autoFocus
                placeholder="Enter wallet password"
                value={password}
                onChange={this.handlePasswordChange}
                onKeyUp={this.handleKeyUp}
                disabled={busy}
              />
            </Form>
            {error ? (
              <Message error header="Unable to unlock" content={error} style={{ display: 'block' }} />
            ) : null}
          </Segment>
        }
        actions={[
          {
            key: 'no',
            content: 'Cancel',
            floated: 'left',
            color: 'red',
            onClick: onCancel,
            disabled: busy,
          },
          {
            key: 'yes',
            content: 'Unlock',
            color: 'purple',
            onClick: this.handleSubmit,
            disabled: !valid || busy,
            loading: busy || checking,
          },
        ]}
      />
    );
  }
}
