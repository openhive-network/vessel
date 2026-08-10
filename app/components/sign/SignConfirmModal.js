// @flow
import React, { Component } from 'react';
import { Button, Input, List, Message, Modal, Segment } from 'semantic-ui-react';

import { describeOp } from '../../utils/signSummary';
import { verifyPasswordInMain } from '../../utils/keystoreVerify';

/**
 * Phase 3 · Task 5 — the confirm-and-sign modal for the `vessel://sign` window. It ALWAYS shows a
 * plain-language summary of exactly what will be signed (the signing account + one line per operation),
 * with Cancel as the safe default. When the account's key is encrypted it also collects the wallet
 * password and verifies it against the MAIN process (the WIF never enters the renderer) before allowing
 * the sign; a legacy plaintext key just confirms (there is no password to require). It never signs
 * anything itself — on approval it calls `onConfirm(password?)` and the container dispatches the
 * existing main-custody sign path.
 *
 * Props: { account, ops, record, onCancel, onConfirm(password?) }.
 */
export default class SignConfirmModal extends Component {
  constructor(props) {
    super(props);
    this.state = { password: '', busy: false, error: null };
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  isEncrypted() {
    const { record } = this.props;
    return !!(record && record.encrypted);
  }

  handlePasswordChange = (e: SyntheticEvent, { value }: { value: string }) => {
    this.setState({ password: value, error: null });
  };

  handleConfirm = async () => {
    const { record, onConfirm } = this.props;
    if (!this.isEncrypted()) {
      onConfirm(); // plaintext legacy key — nothing to unlock
      return;
    }
    const { password, busy } = this.state;
    if (!password || busy) return;
    this.setState({ busy: true, error: null });
    // Verified in the main process; a wrong password never yields a WIF to the renderer.
    const ok = await verifyPasswordInMain(record, password);
    if (!this.mounted) return;
    if (ok) {
      onConfirm(password);
    } else {
      this.setState({ busy: false, password: '', error: 'Incorrect password.' });
    }
  };

  handleKeyUp = (e: SyntheticEvent) => {
    if (e.key === 'Enter' && this.isEncrypted() && !this.state.busy) {
      this.handleConfirm();
    }
  };

  render() {
    const { account, ops, onCancel } = this.props;
    const { password, busy, error } = this.state;
    const encrypted = this.isEncrypted();
    return (
      <Modal
        size="small"
        open
        header="Confirm &amp; Sign"
        content={
          <Segment padded basic loading={busy}>
            <p>
              You are about to sign as <strong>@{account}</strong>:
            </p>
            <List bulleted>
              {(ops || []).map((op, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <List.Item key={`op-${i}`}>{describeOp(op)}</List.Item>
              ))}
            </List>
            {encrypted ? (
              <>
                <p>Enter your wallet password to unlock this key and sign.</p>
                <Input
                  name="password"
                  type="password"
                  fluid
                  focus
                  autoFocus
                  placeholder="Wallet password"
                  value={password}
                  onChange={this.handlePasswordChange}
                  onKeyUp={this.handleKeyUp}
                  disabled={busy}
                />
              </>
            ) : (
              <Message
                info
                size="tiny"
                content="This key is stored without a wallet password; confirm to sign."
              />
            )}
            {error ? <Message error content={error} style={{ display: 'block' }} /> : null}
            <p style={{ marginTop: '1em', color: '#999' }}>
              Once signed and broadcast, this transaction cannot be reversed.
            </p>
          </Segment>
        }
        actions={[
          {
            key: 'cancel',
            content: 'Cancel',
            color: 'red',
            floated: 'left',
            onClick: onCancel,
            disabled: busy,
          },
          {
            key: 'confirm',
            content: encrypted ? 'Unlock & Sign' : 'Confirm & Sign',
            color: 'purple',
            onClick: this.handleConfirm,
            disabled: busy || (encrypted && !password),
            loading: busy,
          },
        ]}
      />
    );
  }
}
