// @flow
import React, { Component } from 'react';
import { Message, Modal, Segment } from 'semantic-ui-react';
import { Form, Input } from 'formsy-semantic-ui-react';
import { hiveAuth } from '../utils/hiveApi';

import { decryptKey, WrongPasswordError } from '../utils/keyEnvelope';

/**
 * §7.3 — the single password-unlock modal, shared by the redux-driven `DecryptPrompt` container
 * and by `Send`'s memo-decrypt path. It captures the password and gates the Unlock button on whether
 * that password actually unlocks the key, then hands the entered password to `onDecrypted` — NEVER
 * through redux.
 *
 * Two modes, chosen by whether an `onVerify` prop is supplied:
 *  - LOCAL (no `onVerify`): decrypt ONE ciphertext in the renderer, validate the result is a WIF, and
 *    pass the cleartext WIF (plus the password, which the caller needs to lazily re-encrypt) to
 *    `onDecrypted(wif, password)`. Used where main custody is unavailable (non-Electron) and by Send's
 *    memo path until D9b B4-2b relocates it.
 *  - REMOTE (D9b B4-2a, `onVerify` supplied): validate the password by calling `onVerify(password)`,
 *    which checks it against the MAIN-process keystore over IPC and returns a boolean — the WIF never
 *    enters the renderer. On submit, `onDecrypted(null, password)` is called; the caller signs in main.
 *
 * Live button feedback (restores the pre-2026 UX): the Unlock button enables only once the typed
 * password validates. The probe is DEBOUNCED (250 ms) — one attempt per typing pause, never one per
 * keystroke (a scrypt decrypt locally, or one IPC round-trip in remote mode).
 *
 * Security invariants:
 *  - LOCAL: the probe WIF and the real WIF live ONLY inside a local scope and are discarded as the
 *    function returns; neither is stored in state nor passed through redux. The client-side check is no
 *    weaker than the encrypted blob already on disk (offline brute-forceable regardless).
 *  - REMOTE: no key material ever reaches the renderer — validation and signing both happen in main.
 *  - On a wrong password the password is CLEARED from component state (spec C8 / §6).
 *
 * Props: { ciphertext, header, onDecrypted, onCancel, onVerify? }.
 *  - LOCAL: onDecrypted(wif, password); REMOTE: onDecrypted(null, password).
 * `onDecrypted` may be async (it performs the field-aware lazy re-encrypt in the local caller); the
 * modal stays busy until it settles so any failure surfaces here.
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
    const { ciphertext, onVerify } = this.props;
    this.setState({ checking: true });
    let ok = false;
    try {
      if (onVerify) {
        // REMOTE: main validates the password (and self-heals a stale/missing record); no WIF here.
        ok = await onVerify(candidate);
      } else {
        const wif = await decryptKey(ciphertext, candidate);
        ok = hiveAuth.isWif(wif); // probe WIF is discarded as this scope returns
      }
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
    const { ciphertext, onDecrypted, onVerify } = this.props;
    this.setState({ busy: true, error: null });
    try {
      if (onVerify) {
        // REMOTE: the password was already validated against main; hand it over with NO WIF — the
        // caller signs in the main process. Nothing is decrypted in the renderer.
        await onDecrypted(null, password);
      } else {
        // LOCAL: the decrypted WIF is scoped to this function; passed to onDecrypted, never stored.
        const wif = await decryptKey(ciphertext, password);
        if (!hiveAuth.isWif(wif)) throw new WrongPasswordError();
        await onDecrypted(wif, password);
      }
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
