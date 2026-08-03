// @flow
import React, { Component } from 'react';
import {
  Button,
  Checkbox,
  Grid,
  Label,
  Message,
  Modal,
  Radio,
  Segment,
  Select,
  Table,
} from 'semantic-ui-react';
import { Form, Input } from 'formsy-semantic-ui-react';
import hive from '@hiveio/hive-js';

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
    <Message>
      <strong>Warning</strong>: Binance changed their deposit address from @deepcrypto8 to
      @bdhivesteem. Use @bdhivesteem instead and make sure to generate a new deposit address memo as
      well.
    </Message>
  ),
  bdhivesteem: (
    <Message>
      <strong>Warning</strong>: Binance changed their deposit address from @deepcrypto8 to
      @bdhivesteem. Make sure to have generated a new deposit address memo instead of using the old
      one for @deepcrypto8.
    </Message>
  ),
};

const exchangeSupportingEncryption = ['bittrex'];

const defaultState = {
  sourceType: 'liquid',
  destinationType: 'liquid',
  from: '',
  to: '',
  amount: '',
  symbol: 'HIVE',
  memo: '',
  memoEncrypted: false,
  encryptMemo: false,
  destination: 'account_liquid',
  // destination: 'exchange',
  memoMissing: false,
  modalPreview: false,
  addContactModal: false,
  newContact: '',
  memoDecryptPrompt: false,
  memoDecrypt: null,
};

export default class Send extends Component {
  constructor(props) {
    super(props);
    this.state = {
      ...defaultState,
      from: props.keys.names[0],
      network: props.hive.props.network || 'Hive',
    };
  }

  componentDidMount() {}

  componentWillUpdate(nextProps, nextState) {}

  componentWillReceiveProps(nextProps) {
    if (nextProps.processing.account_transfer_resolved) {
      nextProps.actions.transferCompleted();
      this.resetState();
    }
  }

  resetState() {
    const { props } = this;
    this.setState({
      to: '',
      amount: '',
      memo: '',
      memoEncrypted: false,
      encryptMemo: false,
      modalPreview: false,
      memoDetected: false,
      memoDecryptPrompt: false,
      memoDecrypt: null,
    });
  }

  handleSourceTypeChange = (e: SyntheticEvent, { value }: { value: any }) => {
    const obj = {
      sourceType: value,
    };
    if (this.state.destinationType === 'same_account') {
      obj.destinationType = value === 'liquid' ? 'savings' : 'liquid';
    } else {
      obj.destinationType = value === 'liquid' ? 'liquid' : 'savings';
    }
    this.setState(obj);
  };

  handleDestinationTypeChange = (e: SyntheticEvent, { value }: { value: any }) => {
    this.setState({
      destinationType: value,
    });
  };

  handleDestinationChange = (e: SyntheticEvent, { value }: { value: any }) => {
    const obj = {
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
      obj.to = this.state.from;
    }
    // } else if (this.state.destinationType === 'same_account') {
    //   obj.destinationType = this.state.sourceType === 'liquid' ? 'liquid' : 'savings'
    // }
    this.setState(obj);
  };

  handleSymbolChange = (e: SyntheticEvent, { value }: { value: any }) => {
    const detectMemo = this.detectMemo(this.state.to, value);
    const newState = {
      amount: '',
      symbol: value,
      memo: detectMemo || '',
      memoDetected: detectMemo,
    };
    this.setState(newState);
  };

  handleMemoEncryptChange = (e: SyntheticEvent, { value }: { value: any }) => {
    if (this.state.encryptMemo === false) {
      this.setState({
        encryptMemo: true,
        memoEncrypted: false,
      });
    } else {
      this.setState({
        encryptMemo: false,
        memoEncrypted: false,
      });
    }
  };

  detectMemo = (to: string, symbol: string) => {
    const { preferences } = this.props;
    const foundExchange = exchangeOptions.filter((e) => e.value === to || e.key === to)[0];
    const preferenceKey = [foundExchange ? foundExchange.key : to, symbol].join('_').toLowerCase();
    if (preferences.hasOwnProperty(preferenceKey) && preferences[preferenceKey].trim !== '') {
      return preferences[preferenceKey];
    }
    return false;
  };

  handleToChange = (e: SyntheticEvent, { value }: { value: string }) => {
    const cleaned = value.replace('@', '').trim();
    if (cleaned === 'add-contact') {
      e.preventDefault();
      this.setState({ addContactModal: true });
      return;
    }
    const newState = {
      encryptMemo: false,
      to: cleaned,
      memo: this.detectMemo(cleaned, this.state.symbol) || '',
      memoDetected: this.detectMemo(cleaned, this.state.symbol),
      memoEncrypted: false,
    };
    // Set state
    this.setState(newState);
  };

  handleMemoChange = (e: SyntheticEvent, { value }: { value: string }) => {
    const cleaned = value.replace(/\s+/gim, ' ');
    this.setState({
      memo: cleaned,
      encryptMemo: false,
      memoEncrypted: false,
    });
  };

  handleAmountChange = (e: SyntheticEvent, { value }: { value: any }) => {
    const cleaned = value.replace(/[a-z\s]+/gim, '');
    this.setState({ amount: cleaned });
  };

  setAmountMaximum = (e: SyntheticEvent) => {
    const { accounts } = this.props.account;
    const { from, symbol } = this.state;
    let field = symbol === 'HBD' ? 'hbd_balance' : 'balance';
    if (this.state.sourceType === 'savings') {
      field = `savings_${field}`;
    }
    const amount = accounts[from][field].split(' ')[0];
    this.setState({ amount });
  };

  handleExternalLink = (e: SyntheticEvent) => {
    window.electronAPI?.openExternal(exchangeLinks[this.state.to]);
  };

  handleFromChange = (e: SyntheticEvent, { value }: { value: any }) => {
    this.setState({
      from: value,
      encryptMemo: false,
      memoEncrypted: false,
    });
  };

  handleContactChange = (e: SyntheticEvent, { value }: { value: string }) => {
    const cleaned = value.replace(/(@|\s)+/gim, ' ');
    this.setState({
      newContact: cleaned,
    });
  };

  isFormValid = () => {
    const cleaned = this.state.memo.trim();
    if (this.state.destination === 'exchange' && cleaned.length === 0) {
      this.setState({ memoMissing: true });
      return false;
    }
    this.setState({ memoMissing: false });
    return true;
  };

  handlePreview = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!this.isFormValid()) {
      console.log('form not valid');
      return;
    }
    const cleaned = this.state.memo.trim();
    if (!this.state.encryptMemo) {
      this.setState({
        memo: cleaned,
        modalPreview: true,
      });
      return;
    }
    const { from, to } = this.state;
    const memoStored = this.props.keys.permissions[from].memo;
    const memoPublic = this.props.account.accounts[from].memo_key;
    if (isEncrypted(memoStored)) {
      // §7.3 — the memo key is a v2 envelope (or legacy blob); decrypting it needs the wallet
      // password. Resolve the recipient's public memo key first, then prompt. The decrypted memo
      // WIF is used exactly once (in handleMemoDecrypted) and never held across renders.
      hive.api.getAccounts([to], (err, result) => {
        if (result && result.length > 0) {
          this.setState({
            memoDecrypt: { toMemoPublic: result[0].memo_key, cleaned },
            memoDecryptPrompt: true,
          });
        } else {
          // no account found
        }
      });
      return;
    }
    // Legacy plaintext memo WIF — behavior unchanged.
    if (memoStored && hive.auth.isWif(memoStored)) {
      // Ensure it's the current memo key on file to prevent a user from using an invalid key
      const derivedKey = hive.auth.wifToPublic(memoStored);
      if (derivedKey === memoPublic) {
        // Load the account we're sending to
        hive.api.getAccounts([to], (err, result) => {
          if (result.length > 0) {
            const toMemoPublic = result[0].memo_key;
            // Generate encrypted memo based on their public memo key + our private memo key
            const memoEncrypted = hive.memo.encode(memoStored, toMemoPublic, `#${cleaned}`);
            this.setState({
              memo: cleaned,
              memoEncrypted,
              modalPreview: true,
            });
          } else {
            // no account found
          }
        });
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
  handleMemoDecrypted = async (memoWif: string | null, password: string) => {
    const { from, memoDecrypt } = this.state;
    if (!memoDecrypt) return;
    const { toMemoPublic, cleaned } = memoDecrypt;
    const memoPublic = this.props.account.accounts[from].memo_key;
    const keystore = window.electronAPI && window.electronAPI.keystore;

    if (memoWif == null && keystore) {
      try {
        let encoded;
        try {
          encoded = await keystore.encodeMemo(from, password, toMemoPublic, `#${cleaned}`, memoPublic);
        } catch (e) {
          // Main missing/stale for this account (e.g. the memo key was added after migration) -> push
          // the renderer's current record and retry once.
          await this.syncRecordToMain(from);
          encoded = await keystore.encodeMemo(from, password, toMemoPublic, `#${cleaned}`, memoPublic);
        }
        this.setState({
          memo: cleaned,
          memoEncrypted: encoded,
          modalPreview: true,
          memoDecryptPrompt: false,
          memoDecrypt: null,
        });
      } catch (e) {
        // Could not encode in main (e.g. the stored memo key no longer matches on chain). Abort the
        // encrypt path without surfacing anything sensitive; the user can retry or send unencrypted.
        this.setState({ memoDecryptPrompt: false, memoDecrypt: null });
      }
      return;
    }

    // LOCAL path.
    const memoStored = this.props.keys.permissions[from].memo;
    // The decrypted memo key must still match the account's on-file memo public key.
    if (hive.auth.wifToPublic(memoWif) !== memoPublic) {
      this.setState({ memoDecryptPrompt: false, memoDecrypt: null });
      return;
    }
    // Lazy-upgrade a stale/legacy memo envelope under the same password.
    if (needsReencrypt(memoStored)) {
      this.props.actions.keyReencrypted({
        account: from,
        memo: await encryptKey(memoWif, password),
      });
    }
    const memoEncrypted = hive.memo.encode(memoWif, toMemoPublic, `#${cleaned}`);
    this.setState({
      memo: cleaned,
      memoEncrypted,
      modalPreview: true,
      memoDecryptPrompt: false,
      memoDecrypt: null,
    });
  };

  // REMOTE memo probe: the memo key shares the account's wallet password (C6), so validate against the
  // main key via keystore.verify; self-heal a missing/stale main record (incl. the memo envelope) once.
  handleMemoVerify = async (password: string) => {
    const { from } = this.state;
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
        await this.syncRecordToMain(from);
        ok = await keystore.verify(from, password);
      } catch (e) {
        ok = false;
      }
    }
    return ok;
  };

  // Push the renderer's current record (main key + memo envelope) into main, overwrite-allowed, to
  // repair a record that is missing or stale. Ciphertext only — no WIF crosses the boundary.
  syncRecordToMain = async (account: string) => {
    const keystore = window.electronAPI && window.electronAPI.keystore;
    const rec = this.props.keys.permissions[account];
    if (!keystore || !rec) return;
    await keystore.putEnvelope({
      account,
      key: rec.key,
      encrypted: true,
      type: rec.type,
      ...(rec.memo !== undefined ? { memo: rec.memo } : {}),
    });
  };

  handleMemoDecryptCancel = () => {
    this.setState({ memoDecryptPrompt: false, memoDecrypt: null });
  };

  handleCancel = (e: SyntheticEvent) => {
    this.setState({
      modalPreview: false,
    });
    e.preventDefault();
  };

  handleConfirm = (e: SyntheticEvent) => {
    const { from, to, symbol, memo, memoEncrypted } = this.state;
    // symbol = symbol.replace("HIVE","STEEM");
    // symbol = symbol.replace("HBD","SBD");
    const usedMemo = memoEncrypted || memo;
    const amount = parseFloat(this.state.amount).toFixed(3);
    const amountFormat = [amount, symbol].join(' ');
    if (this.state.sourceType === 'liquid') {
      this.props.actions.useKey(
        this.state.destinationType !== 'savings' || this.state.destination === 'exchange'
          ? 'transfer'
          : 'transferToSavings',
        { from, to, amount: amountFormat, memo: usedMemo },
        this.props.keys.permissions[from]
      );
    } else {
      let requestId = 0;
      hive.api.getSavingsWithdrawFrom(from, (err, result) => {
        if (result.length !== 0) {
          requestId = result[result.length - 1].request_id + 1;
        }
        this.props.actions.useKey(
          'transferFromSavings',
          { from, requestId, to, amount: amountFormat, memo: usedMemo },
          this.props.keys.permissions[from]
        );
      });
    }
    this.setState({
      modalPreview: false,
    });
    e.preventDefault();
  };

  handleCancelContact = (e: SyntheticEvent) => {
    this.setState({
      addContactModal: false,
    });
    e.preventDefault();
  };

  handleConfirmContact = (e: SyntheticEvent) => {
    const { newContact } = this.state;
    if (newContact !== '') this.props.actions.addContact(newContact);
    this.setState({
      addContactModal: false,
      newContact: '',
    });
    e.preventDefault();
  };

  render() {
    const { accounts } = this.props.account;
    const { keys } = this.props;
    const availableFrom = keys.names.map((name) => {
      const hasPermission =
        keys.permissions[name].type === 'active' || keys.permissions[name].type === 'owner';
      return hasPermission
        ? {
            key: name,
            text: name,
            value: name,
          }
        : {
            key: name,
            disabled: true,
            text: `${name} (unavailable - active/owner key not loaded)`,
          };
    });
    let field = this.state.symbol === 'HBD' ? 'hbd_balance' : 'balance';
    if (this.state.sourceType === 'savings') {
      field = `savings_${field}`;
    }
    const availableAmount = accounts[this.state.from][field];
    const errorLabel = <Label color="red" pointing />;
    let modal = false;

    const getDestinationTypeField = () => {
      if (this.state.destination === 'exchange') return null;
      return (
        <Grid.Column width={4} style={{ marginTop: '25px' }}>
          <div className="field" style={{ marginBottom: '5px' }}>
            <label htmlFor="from">Select the specific destination</label>
          </div>
          <Grid.Row style={{ display: 'flex' }}>
            <Form.Field
              control={Radio}
              name="destinationType"
              label="liquid"
              value="liquid"
              checked={this.state.destinationType === 'liquid'}
              onChange={this.handleDestinationTypeChange}
              style={{ marginRight: '10px' }}
            />
            <Form.Field
              control={Radio}
              name="destinationType"
              label="savings"
              value="savings"
              checked={this.state.destinationType === 'savings'}
              onChange={this.handleDestinationTypeChange}
            />
          </Grid.Row>
        </Grid.Column>
      );
    };

    let toField = (
      <Grid.Row>
        <Form.Field
          control={Input}
          name="to"
          label="Enter the account name"
          placeholder="Enter the account name to send to..."
          value={this.state.to}
          onChange={this.handleToChange}
          // validationErrors={{
          // accountName: 'Invalid account name'
          // }}
          errorLabel={errorLabel}
        />
      </Grid.Row>
    );

    const destinationTypeField = getDestinationTypeField();

    let encryptedField = false;
    if (this.state.destination === 'exchange') {
      let externalLink = false;
      if (this.state.to) {
        externalLink = (
          <p style={{ marginLeft: '1em' }}>
            {exchangeNotes[this.state.to]}
            <a onClick={this.handleExternalLink} value={this.state.to}>
              {' '}
              {exchangeLinks[this.state.to]}
            </a>
          </p>
        );
      }
      toField = (
        <div>
          <Form.Field
            control={Select}
            search
            value={this.state.to}
            label="Select an exchange:"
            options={exchangeOptions}
            onChange={this.handleToChange}
            placeholder="Receiving exchange..."
          />
          {externalLink}
        </div>
      );
    }
    if (this.state.destination === 'contact') {
      let contactList = this.props.account.contacts ? this.props.account.contacts.slice() : [];
      contactList = contactList.map((contact) => ({
        key: contact,
        text: `@${contact}`,
        value: contact,
      }));
      contactList.push({
        key: 'add-contact',
        text: 'Add a New Contact',
        value: 'add-contact',
      });
      toField = (
        <div>
          <Form.Field
            control={Select}
            search
            value={this.state.to}
            label="Select a contact:"
            options={contactList}
            onChange={this.handleToChange}
            placeholder="Saved contact..."
          />
        </div>
      );
    }
    if (
      keys.permissions[this.state.from] &&
      keys.permissions[this.state.from].memo &&
      (isEncrypted(keys.permissions[this.state.from].memo) ||
        hive.auth.isWif(keys.permissions[this.state.from].memo))
    ) {
      if (
        exchangeSupportingEncryption.indexOf(this.state.to) >= 0 ||
        this.state.destination === 'account'
      ) {
        encryptedField = (
          <Form.Field>
            <Checkbox
              label="Encrypt Memo?"
              checked={this.state.encryptMemo}
              onChange={this.handleMemoEncryptChange}
            />
          </Form.Field>
        );
      }
    }
    if (this.state.modalPreview) {
      modal = (
        <Modal
          open
          header="Please confirm the details of this transaction"
          autoFocus
          content={
            <Segment basic padded>
              <p>
                Ensure that all of the data below looks correct before continuing. If you mistakenly
                send to the wrong accout (or with the wrong memo) you may lose funds.
              </p>
              <Table definition collapsing style={{ minWidth: '300px', margin: '0 auto' }}>
                <Table.Body>
                  <Table.Row>
                    <Table.Cell textAlign="right">From:</Table.Cell>
                    <Table.Cell>{this.state.from}</Table.Cell>
                    <Table.Cell>{this.state.sourceType}</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell textAlign="right">To:</Table.Cell>
                    <Table.Cell>{this.state.to}</Table.Cell>
                    <Table.Cell
                      style={{ fontWeight: this.state.destinationType === 'savings' ? 800 : 300 }}
                    >
                      {this.state.destinationType}
                    </Table.Cell>
                  </Table.Row>

                  <Table.Row>
                    <Table.Cell textAlign="right">Amount:</Table.Cell>
                    <Table.Cell>
                      {this.state.amount} {this.state.symbol}
                    </Table.Cell>
                    <Table.Cell />
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell textAlign="right">Memo:</Table.Cell>
                    <Table.Cell>
                      <code>
                        {this.state.memoEncrypted ? this.state.memoEncrypted : this.state.memo}
                      </code>
                    </Table.Cell>
                    <Table.Cell />
                  </Table.Row>
                </Table.Body>
              </Table>
            </Segment>
          }
          actions={[
            {
              key: 'no',
              icon: 'cancel',
              content: 'Cancel',
              color: 'red',
              floated: 'left',
              onClick: this.handleCancel,
              disabled: this.props.processing.account_transfer_pending,
            },
            {
              key: 'yes',
              icon: 'checkmark',
              content: 'Confirmed - this is correct',
              color: 'green',
              onClick: this.handleConfirm,
              disabled: this.props.processing.account_transfer_pending,
            },
          ]}
        />
      );
    }
    if (this.state.addContactModal) {
      modal = (
        <Modal
          open
          header="Add a New Contact"
          content={
            <Segment basic padded>
              <Form>
                <Form.Field
                  control={Input}
                  name="contact"
                  label="Username to add to contact list"
                  placeholder="username (without @)"
                  value={this.state.newContact}
                  onChange={this.handleContactChange}
                />
              </Form>
            </Segment>
          }
          actions={[
            {
              key: 'no',
              icon: 'cancel',
              content: 'Cancel',
              color: 'red',
              floated: 'left',
              onClick: this.handleCancelContact,
            },
            {
              key: 'yes',
              icon: 'checkmark',
              content: 'Confirmed - add contact',
              color: 'green',
              onClick: this.handleConfirmContact,
            },
          ]}
        />
      );
    }
    let memoDecryptModal = false;
    if (this.state.memoDecryptPrompt && keys.permissions[this.state.from]) {
      const remoteMemo = !!(window.electronAPI && window.electronAPI.keystore);
      memoDecryptModal = (
        <DecryptModal
          ciphertext={keys.permissions[this.state.from].memo}
          header="Unlock Encrypted Memo Key"
          onDecrypted={this.handleMemoDecrypted}
          onCancel={this.handleMemoDecryptCancel}
          onVerify={remoteMemo ? this.handleMemoVerify : undefined}
        />
      );
    }
    return (
      <Form
        error={!!this.props.processing.account_transfer_error}
        loading={this.props.processing.account_transfer_pending}
      >
        {modal}
        {memoDecryptModal}
        <Grid divided centered>
          <Grid.Row>
            <Message
              warning
              visible={
                this.state.sourceType === 'savings' || this.state.destination === 'account_savings'
              }
              header="Savings Account Warning"
              content="Transferring from savings account takes 3.5 days and can be cancelled anytime before completion."
            />
          </Grid.Row>
          <Grid.Row>
            <Grid.Column width={4}>
              <div className="field">
                <label htmlFor="from">Send from...</label>
              </div>
              <Form.Field
                control={Radio}
                name="sourceType"
                label="liquid"
                value="liquid"
                checked={this.state.sourceType === 'liquid'}
                onChange={this.handleSourceTypeChange}
              />
              <Form.Field
                control={Radio}
                name="sourceType"
                label="savings"
                value="savings"
                checked={this.state.sourceType === 'savings'}
                onChange={this.handleSourceTypeChange}
              />
            </Grid.Column>
            <Grid.Column width={12}>
              <Form.Field
                control={Select}
                value={this.state.from}
                name="from"
                label="Select a loaded account"
                options={availableFrom}
                placeholder="Sending Account..."
                onChange={this.handleFromChange}
              />
            </Grid.Column>
          </Grid.Row>
          <Grid.Row>
            <Grid.Column width={4}>
              <div className="field">
                <label htmlFor="destination">Send to a...</label>
              </div>

              <Form.Field
                control={Radio}
                name="destination"
                label="another user"
                value="account_liquid"
                checked={this.state.destination === 'account_liquid'}
                onChange={this.handleDestinationChange}
              />
              <Form.Field
                control={Radio}
                name="destination"
                label="an exchange"
                value="exchange"
                checked={this.state.destination === 'exchange'}
                onChange={this.handleDestinationChange}
              />
              <Form.Field
                control={Radio}
                name="destination"
                label="same account"
                value="same_account"
                checked={this.state.destination === 'same_account'}
                onChange={this.handleDestinationChange}
              />
              <Form.Field
                control={Radio}
                name="destination"
                label="saved contact"
                value="contact"
                checked={this.state.destination === 'contact'}
                onChange={this.handleDestinationChange}
              />
            </Grid.Column>
            <Grid.Column width={12}>
              <Grid.Column width={12}>{toField}</Grid.Column>
              <Grid.Column width={12}>{destinationTypeField}</Grid.Column>
            </Grid.Column>
          </Grid.Row>
          <Grid.Row>
            <Grid.Column width={4}>
              <div className="field">
                <label htmlFor="symbol">Select Currency Type</label>
              </div>
              <Form.Field
                control={Radio}
                name="symbol"
                label="HIVE"
                value="HIVE"
                checked={this.state.symbol === 'HIVE'}
                onChange={this.handleSymbolChange}
              />
              <Form.Field
                control={Radio}
                name="symbol"
                label="HBD"
                value="HBD"
                checked={this.state.symbol === 'HBD'}
                onChange={this.handleSymbolChange}
              />
            </Grid.Column>
            <Grid.Column width={12}>
              <div className="field">
                <label htmlFor="amount">Total {this.state.symbol} to Send</label>
              </div>
              <Form.Field
                control={Input}
                name="amount"
                placeholder="Enter the amount to transfer..."
                value={this.state.amount}
                onChange={this.handleAmountChange}
                validationErrors={{
                  isNumeric: 'The amount must be a number',
                }}
                errorLabel={errorLabel}
              />
              <p>
                <a
                  onClick={this.setAmountMaximum}
                  style={{
                    color: 'black',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    textDecoration: 'underline',
                  }}
                >
                  {availableAmount}
                </a>{' '}
                available to send.
              </p>
            </Grid.Column>
          </Grid.Row>
          <Grid.Row>
            <Grid.Column width={16}>
              <Form.Field
                control={Input}
                name="memo"
                label={
                  this.state.memoDetected
                    ? 'Memo automatically set via preferences.'
                    : 'Optional memo to include'
                }
                placeholder="Enter a memo to include with the transaction"
                value={this.state.memo}
                onChange={this.handleMemoChange}
              />
              {encryptedField}
              <Message
                error
                visible={this.state.memoMissing}
                header="Form Validation Error"
                content="A memo is required when sending to an exchange otherwise you may lose your tokens."
              />
            </Grid.Column>
          </Grid.Row>
          <Grid.Row>
            <Grid.Column width={16} textAlign="center">
              <Message
                error
                header="Operation Error"
                content={this.props.processing.account_transfer_error}
              />
              <Form.Field
                control={Button}
                color="purple"
                content="Preview Transaction"
                onClick={this.handlePreview}
              />
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </Form>
    );
  }
}
