import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Checkbox,
  Grid,
  Group,
  LoadingOverlay,
  Modal,
  Radio,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { hiveApi, hiveAuth, hiveMemo } from '../utils/hiveApi';

import DecryptModal from './DecryptModal';
import { encryptKey, isEncrypted, needsReencrypt } from '../utils/keyEnvelope';

const exchangeOptions = [
  {
    key: 'binance_bdhivesteem',
    text: 'Binance (@bdhivesteem)',
    value: 'bdhivesteem',
  },
  {
    key: 'bittrex',
    text: 'Bittrex (@bittrex)',
    value: 'bittrex',
  },
  {
    key: 'huobi',
    text: 'Huobi (@huobi-pro)',
    value: 'huobi-pro',
  },
  {
    key: 'gateio',
    text: 'Gate.io (@gateiodeposit)',
    value: 'gateiodeposit',
  },
  {
    key: 'ionomy',
    text: 'Ionomy (@ionomy)',
    value: 'ionomy',
  },
  {
    key: 'probit',
    text: 'Probit (@probithive)',
    value: 'probithive',
  },
  {
    key: 'mxc',
    text: 'MXC (@mxchive)',
    value: 'mxchive',
  },
  {
    key: 'binance',
    text: 'DEPRECATED - Binance (@deepcrypto8)',
    value: 'deepcrypto8',
  },
];

const exchangeLinks = {
  bittrex: 'https://bittrex.com',
  'huobi-pro': 'https://huobi.com',
  bdhivesteem: 'https://binance.com',
  deepcrypto8: 'https://binance.com',
  ionomy: 'https://ionomy.com',
  probithive: 'https://probit.com',
  mxchive: 'https://mxc.com',
  gateiodeposit: 'https://gate.io',
};

const exchangeNotes = {
  deepcrypto8: (
    <Alert color="yellow" mt="xs">
      <strong>Warning</strong>: Binance changed their deposit address from @deepcrypto8 to
      @bdhivesteem. Use @bdhivesteem instead and make sure to generate a new deposit address memo as
      well.
    </Alert>
  ),
  bdhivesteem: (
    <Alert color="yellow" mt="xs">
      <strong>Warning</strong>: Binance changed their deposit address from @deepcrypto8 to
      @bdhivesteem. Make sure to have generated a new deposit address memo instead of using the old
      one for @deepcrypto8.
    </Alert>
  ),
};

const exchangeSupportingEncryption = ['bittrex'];

const Send: React.FC<any> = (props) => {
  const [sourceType, setSourceType] = useState<any>('liquid');
  const [destinationType, setDestinationType] = useState<any>('liquid');
  const [from, setFrom] = useState<any>(props.keys.names[0]);
  const [to, setTo] = useState<any>('');
  const [amountValue, setAmountValue] = useState<any>('');
  const [symbol, setSymbol] = useState<any>('HIVE');
  const [memo, setMemo] = useState<any>('');
  const [memoEncrypted, setMemoEncrypted] = useState<any>(false);
  const [encryptMemo, setEncryptMemo] = useState<any>(false);
  const [destination, setDestination] = useState<any>('account_liquid');
  const [memoMissing, setMemoMissing] = useState<any>(false);
  const [modalPreview, setModalPreview] = useState<any>(false);
  const [addContactModal, setAddContactModal] = useState<any>(false);
  const [newContact, setNewContact] = useState<any>('');
  const [memoDecryptPrompt, setMemoDecryptPrompt] = useState<any>(false);
  const [memoDecrypt, setMemoDecrypt] = useState<any>(null);
  const [memoDetected, setMemoDetected] = useState<any>(false);

  const resetState = () => {
    setTo('');
    setAmountValue('');
    setMemo('');
    setMemoEncrypted(false);
    setEncryptMemo(false);
    setModalPreview(false);
    setMemoDetected(false);
    setMemoDecryptPrompt(false);
    setMemoDecrypt(null);
  };

  // componentWillReceiveProps(account_transfer_resolved -> transferCompleted() + resetState()).
  // useRef seed so the effect fires on the truthy transition, not on mount.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (props.processing.account_transfer_resolved) {
      props.actions.transferCompleted();
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.processing.account_transfer_resolved]);

  const handleSourceTypeChange = (value: any) => {
    const obj: any = {
      sourceType: value,
    };
    if (destinationType === 'same_account') {
      obj.destinationType = value === 'liquid' ? 'savings' : 'liquid';
    } else {
      obj.destinationType = value === 'liquid' ? 'liquid' : 'savings';
    }
    setSourceType(obj.sourceType);
    setDestinationType(obj.destinationType);
  };

  const handleDestinationTypeChange = (value: any) => {
    setDestinationType(value);
  };

  const handleDestinationChange = (value: any) => {
    const obj: any = {
      to: '',
      memo: '',
      destination: value,
      encryptMemo: false,
      memoEncrypted: false,
    };
    if (value === 'exchange') {
      obj.destinationType = 'liquid';
    } else if (value === 'same_account') {
      // obj.destinationType = this.state.sourceType === 'liquid' ? 'savings' : 'liquid'
      obj.to = from;
    }
    setTo(obj.to);
    setMemo(obj.memo);
    setDestination(obj.destination);
    setEncryptMemo(obj.encryptMemo);
    setMemoEncrypted(obj.memoEncrypted);
    if (obj.destinationType !== undefined) setDestinationType(obj.destinationType);
  };

  const handleSymbolChange = (value: any) => {
    const detectMemoResult = detectMemo(to, value);
    setAmountValue('');
    setSymbol(value);
    setMemo(detectMemoResult || '');
    setMemoDetected(detectMemoResult);
  };

  const handleMemoEncryptChange = () => {
    if (encryptMemo === false) {
      setEncryptMemo(true);
      setMemoEncrypted(false);
    } else {
      setEncryptMemo(false);
      setMemoEncrypted(false);
    }
  };

  const detectMemo = (to: any, symbol: any) => {
    const { preferences } = props;
    const foundExchange = exchangeOptions.filter((e) => e.value === to || e.key === to)[0];
    const preferenceKey = [foundExchange ? foundExchange.key : to, symbol].join('_').toLowerCase();
    // eslint-disable-next-line no-prototype-builtins
    if (preferences.hasOwnProperty(preferenceKey) && preferences[preferenceKey].trim !== '') {
      return preferences[preferenceKey];
    }
    return false;
  };

  const handleToChange = (value: any, e?: any) => {
    const cleaned = value.replace('@', '').trim();
    if (cleaned === 'add-contact') {
      if (e) e.preventDefault();
      setAddContactModal(true);
      return;
    }
    setEncryptMemo(false);
    setTo(cleaned);
    setMemo(detectMemo(cleaned, symbol) || '');
    setMemoDetected(detectMemo(cleaned, symbol));
    setMemoEncrypted(false);
  };

  const handleMemoChange = (value: any) => {
    const cleaned = value.replace(/\s+/gim, ' ');
    setMemo(cleaned);
    setEncryptMemo(false);
    setMemoEncrypted(false);
  };

  const handleAmountChange = (value: any) => {
    const cleaned = value.replace(/[a-z\s]+/gim, '');
    setAmountValue(cleaned);
  };

  const setAmountMaximum = () => {
    const { accounts } = props.account;
    let field = symbol === 'HBD' ? 'hbd_balance' : 'balance';
    if (sourceType === 'savings') {
      field = `savings_${field}`;
    }
    const amount = accounts[from][field].split(' ')[0];
    setAmountValue(amount);
  };

  const handleExternalLink = () => {
    window.electronAPI?.openExternal(exchangeLinks[to]);
  };

  const handleFromChange = (value: any) => {
    setFrom(value);
    setEncryptMemo(false);
    setMemoEncrypted(false);
  };

  const handleContactChange = (value: any) => {
    const cleaned = value.replace(/(@|\s)+/gim, ' ');
    setNewContact(cleaned);
  };

  const isFormValid = () => {
    const cleaned = memo.trim();
    if (destination === 'exchange' && cleaned.length === 0) {
      setMemoMissing(true);
      return false;
    }
    setMemoMissing(false);
    return true;
  };

  const handlePreview = (e: any) => {
    e.preventDefault();
    if (!isFormValid()) {
      console.log('form not valid');
      return;
    }
    const cleaned = memo.trim();
    if (!encryptMemo) {
      setMemo(cleaned);
      setModalPreview(true);
      return;
    }
    const memoStored = props.keys.permissions[from].memo;
    const memoPublic = props.account.accounts[from].memo_key;
    if (isEncrypted(memoStored)) {
      // §7.3 — the memo key is a v2 envelope (or legacy blob); decrypting it needs the wallet
      // password. Resolve the recipient's public memo key first, then prompt. The decrypted memo
      // WIF is used exactly once (in handleMemoDecrypted) and never held across renders.
      hiveApi.getAccounts([to]).then((result) => {
        if (result && result.length > 0) {
          setMemoDecrypt({ toMemoPublic: result[0].memo_key, cleaned });
          setMemoDecryptPrompt(true);
        } else {
          // no account found
        }
      }, () => {});
      return;
    }
    // Legacy plaintext memo WIF — behavior unchanged.
    if (memoStored && hiveAuth.isWif(memoStored)) {
      // Ensure it's the current memo key on file to prevent a user from using an invalid key
      const derivedKey = hiveAuth.wifToPublic(memoStored);
      if (derivedKey === memoPublic) {
        // Load the account we're sending to
        hiveApi.getAccounts([to]).then((result) => {
          if (result.length > 0) {
            const toMemoPublic = result[0].memo_key;
            // Generate encrypted memo based on their public memo key + our private memo key
            const memoEncrypted = hiveMemo.encode(memoStored, toMemoPublic, `#${cleaned}`);
            setMemo(cleaned);
            setMemoEncrypted(memoEncrypted);
            setModalPreview(true);
          } else {
            // no account found
          }
        }, () => {});
      } else {
        // memo key saved on account doesn't match blockchain
      }
    } else {
      // memo key is not saved or is not valid wif
    }
  };

  // §7.3 / D9b B4-2b — invoked by DecryptModal once the wallet password is captured. Two paths:
  //  - REMOTE (Electron, memoWif === null): main holds the memo key and both decrypts AND encodes the
  //    memo internally, so the memo WIF NEVER enters the renderer. The password was already validated
  //    against main by the modal's onVerify; `memoPublic` re-enforces the stale-memo-key guard in main.
  //  - LOCAL (non-Electron): the modal decrypted the memo WIF; encode it here, exactly as before. The
  //    decrypted WIF is scoped to this handler — encoded immediately, never stored across renders.
  const handleMemoDecrypted = async (memoWif: any, password: any) => {
    if (!memoDecrypt) return;
    const { toMemoPublic, cleaned } = memoDecrypt;
    const memoPublic = props.account.accounts[from].memo_key;
    const keystore = window.electronAPI && window.electronAPI.keystore;

    if (memoWif == null && keystore) {
      try {
        let encoded;
        try {
          encoded = await keystore.encodeMemo(from, password, toMemoPublic, `#${cleaned}`, memoPublic);
        } catch (e) {
          // Main missing/stale for this account (e.g. the memo key was added after migration) -> push
          // the renderer's current record and retry once.
          await syncRecordToMain(from);
          encoded = await keystore.encodeMemo(from, password, toMemoPublic, `#${cleaned}`, memoPublic);
        }
        setMemo(cleaned);
        setMemoEncrypted(encoded);
        setModalPreview(true);
        setMemoDecryptPrompt(false);
        setMemoDecrypt(null);
      } catch (e) {
        // Could not encode in main (e.g. the stored memo key no longer matches on chain). Abort the
        // encrypt path without surfacing anything sensitive; the user can retry or send unencrypted.
        setMemoDecryptPrompt(false);
        setMemoDecrypt(null);
      }
      return;
    }

    // LOCAL path.
    const memoStored = props.keys.permissions[from].memo;
    // The decrypted memo key must still match the account's on-file memo public key.
    if (hiveAuth.wifToPublic(memoWif) !== memoPublic) {
      setMemoDecryptPrompt(false);
      setMemoDecrypt(null);
      return;
    }
    // Lazy-upgrade a stale/legacy memo envelope under the same password.
    if (needsReencrypt(memoStored)) {
      props.actions.keyReencrypted({
        account: from,
        memo: await encryptKey(memoWif, password),
      });
    }
    const memoEncrypted = hiveMemo.encode(memoWif, toMemoPublic, `#${cleaned}`);
    setMemo(cleaned);
    setMemoEncrypted(memoEncrypted);
    setModalPreview(true);
    setMemoDecryptPrompt(false);
    setMemoDecrypt(null);
  };

  // REMOTE memo probe: the memo key shares the account's wallet password (C6), so validate against the
  // main key via keystore.verify; self-heal a missing/stale main record (incl. the memo envelope) once.
  const handleMemoVerify = async (password: any) => {
    const keystore = window.electronAPI && window.electronAPI.keystore;
    if (!keystore) return false;
    let ok = false;
    try {
      ok = await keystore.verify(from, password);
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      try {
        await syncRecordToMain(from);
        ok = await keystore.verify(from, password);
      } catch (e) {
        ok = false;
      }
    }
    return ok;
  };

  // Push the renderer's current record (main key + memo envelope) into main, overwrite-allowed, to
  // repair a record that is missing or stale. Ciphertext only — no WIF crosses the boundary.
  const syncRecordToMain = async (account: any) => {
    const keystore = window.electronAPI && window.electronAPI.keystore;
    const rec = props.keys.permissions[account];
    if (!keystore || !rec) return;
    await keystore.putEnvelope({
      account,
      key: rec.key,
      encrypted: true,
      type: rec.type,
      ...(rec.memo !== undefined ? { memo: rec.memo } : {}),
    });
  };

  const handleMemoDecryptCancel = () => {
    setMemoDecryptPrompt(false);
    setMemoDecrypt(null);
  };

  const handleCancel = (e?: any) => {
    setModalPreview(false);
    if (e && e.preventDefault) e.preventDefault();
  };

  const handleConfirm = (e: any) => {
    const usedMemo = memoEncrypted || memo;
    const amount = parseFloat(amountValue).toFixed(3);
    const amountFormat = [amount, symbol].join(' ');
    if (sourceType === 'liquid') {
      props.actions.useKey(
        destinationType !== 'savings' || destination === 'exchange'
          ? 'transfer'
          : 'transferToSavings',
        { from, to, amount: amountFormat, memo: usedMemo },
        props.keys.permissions[from]
      );
    } else {
      let requestId = 0;
      hiveApi.getSavingsWithdrawFrom(from).then((result) => {
        if (result.length !== 0) {
          requestId = result[result.length - 1].request_id + 1;
        }
        props.actions.useKey(
          'transferFromSavings',
          { from, requestId, to, amount: amountFormat, memo: usedMemo },
          props.keys.permissions[from]
        );
      }, () => {});
    }
    setModalPreview(false);
    e.preventDefault();
  };

  const handleCancelContact = (e?: any) => {
    setAddContactModal(false);
    if (e && e.preventDefault) e.preventDefault();
  };

  const handleConfirmContact = (e: any) => {
    if (newContact !== '') props.actions.addContact(newContact);
    setAddContactModal(false);
    setNewContact('');
    e.preventDefault();
  };

  const { accounts } = props.account;
  const { keys } = props;
  const availableFrom = keys.names.map((name) => {
    const hasPermission =
      keys.permissions[name].type === 'active' || keys.permissions[name].type === 'owner';
    return hasPermission
      ? {
          value: name,
          label: name,
        }
      : {
          value: name,
          label: `${name} (unavailable - active/owner key not loaded)`,
          disabled: true,
        };
  });
  let field = symbol === 'HBD' ? 'hbd_balance' : 'balance';
  if (sourceType === 'savings') {
    field = `savings_${field}`;
  }
  const availableAmount = accounts[from][field];
  let modal: any = false;

  const destinationTypeField =
    destination === 'exchange' ? null : (
      <Box mt="md">
        <Radio.Group
          value={destinationType}
          onChange={handleDestinationTypeChange}
          label="Select the specific destination"
        >
          <Group mt="xs">
            <Radio value="liquid" label="liquid" />
            <Radio value="savings" label="savings" />
          </Group>
        </Radio.Group>
      </Box>
    );

  let toField: any = (
    <TextInput
      label="Enter the account name"
      placeholder="Enter the account name to send to..."
      value={to}
      onChange={(e) => handleToChange(e.currentTarget.value, e)}
    />
  );

  let encryptedField: any = false;
  if (destination === 'exchange') {
    let externalLink: any = false;
    if (to) {
      externalLink = (
        <Text component="div" ml="sm" mt="xs">
          {exchangeNotes[to]}
          <Anchor onClick={handleExternalLink}> {exchangeLinks[to]}</Anchor>
        </Text>
      );
    }
    const exchangeData = exchangeOptions.map((e) => ({ value: e.value, label: e.text }));
    toField = (
      <div>
        <Select
          searchable
          value={to}
          label="Select an exchange:"
          data={exchangeData}
          onChange={(value) => value && handleToChange(value)}
          placeholder="Receiving exchange..."
        />
        {externalLink}
      </div>
    );
  }
  if (destination === 'contact') {
    let contactList = props.account.contacts ? props.account.contacts.slice() : [];
    contactList = contactList.map((contact) => ({
      value: contact,
      label: `@${contact}`,
    }));
    contactList.push({
      value: 'add-contact',
      label: 'Add a New Contact',
    });
    toField = (
      <div>
        <Select
          searchable
          value={to}
          label="Select a contact:"
          data={contactList}
          onChange={(value) => value && handleToChange(value)}
          placeholder="Saved contact..."
        />
      </div>
    );
  }
  if (
    keys.permissions[from] &&
    keys.permissions[from].memo &&
    (isEncrypted(keys.permissions[from].memo) || hiveAuth.isWif(keys.permissions[from].memo))
  ) {
    // Offer memo encryption to any Hive-account recipient (another user / same account / saved
    // contact) — all have a memo key that can decrypt it. Exchanges are excluded (they need the
    // PLAINTEXT memo to credit the deposit) except those historically supporting it (Bittrex). The
    // old check compared against 'account', a destination value no radio sets ("another user" is
    // 'account_liquid'), so this option was unreachable for user-to-user transfers.
    if (
      exchangeSupportingEncryption.indexOf(to) >= 0 ||
      destination === 'account_liquid' ||
      destination === 'same_account' ||
      destination === 'contact'
    ) {
      encryptedField = (
        <Checkbox
          mt="sm"
          label="Encrypt Memo?"
          checked={encryptMemo}
          onChange={handleMemoEncryptChange}
        />
      );
    }
  }
  if (modalPreview) {
    modal = (
      <Modal
        opened
        onClose={handleCancel}
        title="Please confirm the details of this transaction"
        size="lg"
      >
        <Box p="md">
          <Text>
            Ensure that all of the data below looks correct before continuing. If you mistakenly send
            to the wrong accout (or with the wrong memo) you may lose funds.
          </Text>
          <Table mt="md" style={{ minWidth: '300px', margin: '0 auto' }}>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td ta="right">From:</Table.Td>
                <Table.Td>{from}</Table.Td>
                <Table.Td>{sourceType}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td ta="right">To:</Table.Td>
                <Table.Td>{to}</Table.Td>
                <Table.Td style={{ fontWeight: destinationType === 'savings' ? 800 : 300 }}>
                  {destinationType}
                </Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td ta="right">Amount:</Table.Td>
                <Table.Td>
                  {amountValue} {symbol}
                </Table.Td>
                <Table.Td />
              </Table.Tr>
              <Table.Tr>
                <Table.Td ta="right">Memo:</Table.Td>
                <Table.Td>
                  <code>{memoEncrypted ? memoEncrypted : memo}</code>
                </Table.Td>
                <Table.Td />
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Box>
        <Group justify="space-between" mt="md">
          <Button
            color="red"
            onClick={handleCancel}
            disabled={props.processing.account_transfer_pending}
          >
            Cancel
          </Button>
          <Button
            color="green"
            onClick={handleConfirm}
            disabled={props.processing.account_transfer_pending}
          >
            Confirmed - this is correct
          </Button>
        </Group>
      </Modal>
    );
  }
  if (addContactModal) {
    modal = (
      <Modal opened onClose={handleCancelContact} title="Add a New Contact">
        <Box p="md">
          <TextInput
            label="Username to add to contact list"
            placeholder="username (without @)"
            data-autofocus
            value={newContact}
            onChange={(e) => handleContactChange(e.currentTarget.value)}
          />
        </Box>
        <Group justify="flex-end" mt="md">
          <Button color="red" onClick={handleCancelContact}>
            Cancel
          </Button>
          <Button color="green" onClick={handleConfirmContact}>
            Confirmed - add contact
          </Button>
        </Group>
      </Modal>
    );
  }
  let memoDecryptModal: any = false;
  if (memoDecryptPrompt && keys.permissions[from]) {
    const remoteMemo = !!(window.electronAPI && window.electronAPI.keystore);
    memoDecryptModal = (
      <DecryptModal
        ciphertext={keys.permissions[from].memo}
        header="Unlock Encrypted Memo Key"
        onDecrypted={handleMemoDecrypted}
        onCancel={handleMemoDecryptCancel}
        onVerify={remoteMemo ? handleMemoVerify : undefined}
      />
    );
  }
  return (
    <Box pos="relative" p="md">
      <LoadingOverlay visible={props.processing.account_transfer_pending} />
      {modal}
      {memoDecryptModal}
      <Grid columns={16} gutter="lg">
        <Grid.Col span={16}>
          {(sourceType === 'savings' || destination === 'account_savings') && (
            <Alert color="yellow" title="Savings Account Warning">
              Transferring from savings account takes 3.5 days and can be cancelled anytime before
              completion.
            </Alert>
          )}
        </Grid.Col>
        <Grid.Col span={4}>
          <Radio.Group value={sourceType} onChange={handleSourceTypeChange} label="Send from...">
            <Group mt="xs">
              <Radio value="liquid" label="liquid" />
              <Radio value="savings" label="savings" />
            </Group>
          </Radio.Group>
        </Grid.Col>
        <Grid.Col span={12}>
          <Select
            value={from}
            label="Select a loaded account"
            data={availableFrom}
            placeholder="Sending Account..."
            onChange={(value) => value && handleFromChange(value)}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <Radio.Group value={destination} onChange={handleDestinationChange} label="Send to a...">
            <Stack gap="xs" mt="xs">
              <Radio value="account_liquid" label="another user" />
              <Radio value="exchange" label="an exchange" />
              <Radio value="same_account" label="same account" />
              <Radio value="contact" label="saved contact" />
            </Stack>
          </Radio.Group>
        </Grid.Col>
        <Grid.Col span={12}>
          {toField}
          {destinationTypeField}
        </Grid.Col>
        <Grid.Col span={4}>
          <Radio.Group value={symbol} onChange={handleSymbolChange} label="Select Currency Type">
            <Group mt="xs">
              <Radio value="HIVE" label="HIVE" />
              <Radio value="HBD" label="HBD" />
            </Group>
          </Radio.Group>
        </Grid.Col>
        <Grid.Col span={12}>
          <TextInput
            label={`Total ${symbol} to Send`}
            placeholder="Enter the amount to transfer..."
            value={amountValue}
            onChange={(e) => handleAmountChange(e.currentTarget.value)}
          />
          <Text mt="xs">
            <Anchor
              onClick={setAmountMaximum}
              c="var(--mantine-color-text)"
              fw={700}
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
            >
              {availableAmount}
            </Anchor>{' '}
            available to send.
          </Text>
        </Grid.Col>
        <Grid.Col span={16}>
          <TextInput
            label={
              memoDetected ? 'Memo automatically set via preferences.' : 'Optional memo to include'
            }
            placeholder="Enter a memo to include with the transaction"
            value={memo}
            onChange={(e) => handleMemoChange(e.currentTarget.value)}
          />
          {encryptedField}
          {memoMissing && (
            <Alert color="red" title="Form Validation Error" mt="sm">
              A memo is required when sending to an exchange otherwise you may lose your tokens.
            </Alert>
          )}
        </Grid.Col>
        <Grid.Col span={16} ta="center">
          {props.processing.account_transfer_error && (
            <Alert color="red" title="Operation Error" mb="md">
              {props.processing.account_transfer_error}
            </Alert>
          )}
          <Button color="grape" onClick={handlePreview}>
            Preview Transaction
          </Button>
        </Grid.Col>
      </Grid>
    </Box>
  );
};

export default Send;
