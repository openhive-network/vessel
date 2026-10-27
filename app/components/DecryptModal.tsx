import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Group, LoadingOverlay, Modal, PasswordInput, Text } from '@mantine/core';
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
 *    `onDecrypted(wif, password)`. Used ONLY when there is no main keystore bridge (the renderer
 *    outside Electron — see utils/keyCustody); every Electron window passes `onVerify`.
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

export default function DecryptModal(props: any) {
  const { ciphertext, header, onDecrypted, onCancel, onVerify } = props;

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState(false);
  const [checking, setChecking] = useState(false);

  const mounted = useRef(true);
  const checkToken = useRef(0);
  const debounce = useRef<any>(null);

  // The debounced probe fires from a timeout set in an earlier render; read the LATEST props through
  // this ref so a mid-typing prop change (e.g. a swapped ciphertext) can never be validated stale.
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    mounted.current = true; // re-assert on (re)mount so a StrictMode remount can't freeze updates
    return () => {
      mounted.current = false;
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  const validate = async (candidate: any) => {
    const token = (checkToken.current += 1);
    const { ciphertext: latestCiphertext, onVerify: latestOnVerify } = propsRef.current;
    setChecking(true);
    let ok = false;
    try {
      if (latestOnVerify) {
        // REMOTE: main validates the password (and self-heals a stale/missing record); no WIF here.
        ok = await latestOnVerify(candidate);
      } else {
        const wif = await decryptKey(latestCiphertext, candidate);
        ok = hiveAuth.isWif(wif); // probe WIF is discarded as this scope returns
      }
    } catch (err) {
      ok = false;
    }
    // Ignore stale probes (the user kept typing) and post-unmount updates.
    if (!mounted.current || token !== checkToken.current) return;
    setValid(ok);
    setChecking(false);
  };

  const handlePasswordChange = (value: string) => {
    // Track the input, drop any prior error/validity, then (debounced) probe whether it decrypts.
    setPassword(value);
    setError(null);
    setValid(false);
    if (debounce.current) clearTimeout(debounce.current);
    if (!value) {
      setChecking(false);
      return;
    }
    debounce.current = setTimeout(() => validate(value), DEBOUNCE_MS);
  };

  const handleSubmit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!password || busy || !valid) return;
    setBusy(true);
    setError(null);
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
      if (mounted.current) {
        setPassword('');
        setBusy(false);
        setError(null);
        setValid(false);
      }
    } catch (err) {
      if (mounted.current) {
        setBusy(false);
        setPassword(''); // clear the password on any failure (C8)
        setValid(false);
        setError(
          err instanceof WrongPasswordError ? 'Incorrect password.' : 'Unable to decrypt this key.'
        );
      }
    }
  };

  const handleKeyUp = (e: any) => {
    if (e.key === 'Enter' && valid && !busy) {
      handleSubmit(e);
    }
  };

  return (
    // Match the original Semantic modal: dismissable ONLY via the Cancel button (which is disabled
    // while busy) — no Escape / overlay-click / close-X, so there is no un-gated cancel path mid-sign.
    <Modal
      size="sm"
      opened
      onClose={onCancel}
      title={header}
      closeOnEscape={false}
      closeOnClickOutside={false}
      withCloseButton={false}
    >
      <Box pos="relative">
        <LoadingOverlay visible={busy} />
        <Text>This key is encrypted locally. Enter your wallet password to unlock it and continue.</Text>
        <PasswordInput
          mt="md"
          autoFocus
          placeholder="Enter wallet password"
          value={password}
          onChange={(e) => handlePasswordChange(e.currentTarget.value)}
          onKeyUp={handleKeyUp}
          disabled={busy}
        />
        {error ? (
          <Alert color="red" title="Unable to unlock" mt="md">
            {error}
          </Alert>
        ) : null}
      </Box>
      <Group justify="space-between" mt="md">
        <Button color="red" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          color="grape"
          onClick={handleSubmit}
          disabled={!valid || busy}
          loading={busy || checking}
        >
          Unlock
        </Button>
      </Group>
    </Modal>
  );
}
