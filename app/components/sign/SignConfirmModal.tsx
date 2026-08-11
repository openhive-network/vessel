import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Group, List, LoadingOverlay, Modal, PasswordInput, Text } from '@mantine/core';

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
export default function SignConfirmModal(props: any) {
  const { account, ops, record, onCancel, onConfirm } = props;

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true; // re-assert on (re)mount so a StrictMode remount can't freeze updates
    return () => {
      mounted.current = false;
    };
  }, []);

  const isEncrypted = () => !!(record && record.encrypted);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!isEncrypted()) {
      onConfirm(); // plaintext legacy key — nothing to unlock
      return;
    }
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    // Verified in the main process; a wrong password never yields a WIF to the renderer.
    const ok = await verifyPasswordInMain(record, password);
    if (!mounted.current) return;
    if (ok) {
      onConfirm(password);
    } else {
      setBusy(false);
      setPassword('');
      setError('Incorrect password.');
    }
  };

  const handleKeyUp = (e: any) => {
    if (e.key === 'Enter' && isEncrypted() && !busy) {
      handleConfirm();
    }
  };

  const encrypted = isEncrypted();
  return (
    // Match the original Semantic modal: dismissable ONLY via the Cancel button (which is disabled
    // while busy) — no Escape / overlay-click / close-X, so there is no un-gated cancel path mid-sign.
    <Modal
      size="sm"
      opened
      onClose={onCancel}
      title="Confirm & Sign"
      closeOnEscape={false}
      closeOnClickOutside={false}
      withCloseButton={false}
    >
      <Box pos="relative">
        <LoadingOverlay visible={busy} />
        <Text>
          You are about to sign as <strong>@{account}</strong>:
        </Text>
        <List withPadding listStyleType="disc" mt="xs">
          {(ops || []).map((op, i) => (
            <List.Item key={`op-${i}`}>{describeOp(op)}</List.Item>
          ))}
        </List>
        {encrypted ? (
          <>
            <Text mt="md">Enter your wallet password to unlock this key and sign.</Text>
            <PasswordInput
              mt="xs"
              autoFocus
              placeholder="Wallet password"
              value={password}
              onChange={(e) => handlePasswordChange(e.currentTarget.value)}
              onKeyUp={handleKeyUp}
              disabled={busy}
            />
          </>
        ) : (
          <Alert color="blue" mt="md">
            This key is stored without a wallet password; confirm to sign.
          </Alert>
        )}
        {error ? (
          <Alert color="red" mt="md">
            {error}
          </Alert>
        ) : null}
        <Text mt="md" c="dimmed">
          Once signed and broadcast, this transaction cannot be reversed.
        </Text>
      </Box>
      <Group justify="space-between" mt="md">
        <Button color="red" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          color="grape"
          onClick={handleConfirm}
          disabled={busy || (encrypted && !password)}
          loading={busy}
        >
          {encrypted ? 'Unlock & Sign' : 'Confirm & Sign'}
        </Button>
      </Group>
    </Modal>
  );
}
