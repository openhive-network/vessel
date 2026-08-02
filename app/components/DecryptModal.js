// @flow
import React, { Component } from 'react';
import { Message, Modal, Segment } from 'semantic-ui-react';
import { Form, Input } from 'formsy-semantic-ui-react';
import hive from '@hiveio/hive-js';

import { decryptKey, WrongPasswordError } from '../utils/keyEnvelope';

/**
 * §7.3 — the single password-unlock modal, shared by the redux-driven `DecryptPrompt` container
 * and by `Send`'s memo-decrypt path. It captures the password, decrypts ONE ciphertext, and
 * validates the result is a WIF, then hands the cleartext WIF (plus the entered password, which
 * the caller needs to lazily re-encrypt) to `onDecrypted` — NEVER through redux.
 *
 * Security invariants:
 *  - No decryption per keystroke (scrypt is ~1 s; per-keystroke would be a password oracle + unusable).
 *  - The decrypted WIF lives ONLY inside `handleSubmit`'s scope and the synchronous `onDecrypted` call.
 *  - On a wrong password the password is CLEARED from component state (spec C8 / §6).
 *
 * Props: { ciphertext, header, onDecrypted(wif, password), onCancel }.
 * `onDecrypted` may be async (it performs the field-aware lazy re-encrypt in the caller); the modal
 * stays busy until it settles so any failure surfaces here.
 */
export default class DecryptModal extends Component {
  constructor(props) {
    super(props);
    this.state = { password: '', busy: false, error: null };
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  handlePasswordChange = (e: SyntheticEvent, { value }: { value: string }) => {
    // NO decryption here — just track the input and clear any prior error.
    this.setState({ password: value, error: null });
  };

  handleKeyUp = (e: SyntheticEvent) => {
    if (e.key === 'Enter' && this.state.password && !this.state.busy) {
      this.handleSubmit(e);
    }
  };

  handleSubmit = async (e: SyntheticEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    const { password, busy } = this.state;
    if (!password || busy) return;
    const { ciphertext, onDecrypted } = this.props;
    this.setState({ busy: true, error: null });
    try {
      // The decrypted WIF is scoped to this function; it is passed to onDecrypted and never stored.
      const wif = await decryptKey(ciphertext, password);
      if (!hive.auth.isWif(wif)) throw new WrongPasswordError();
      await onDecrypted(wif, password);
      if (this.mounted) this.setState({ password: '', busy: false, error: null });
    } catch (err) {
      if (this.mounted) {
        this.setState({
          busy: false,
          password: '', // clear the password on any failure (C8)
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
    const { password, busy, error } = this.state;
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
            disabled: !password || busy,
            loading: busy,
          },
        ]}
      />
    );
  }
}
