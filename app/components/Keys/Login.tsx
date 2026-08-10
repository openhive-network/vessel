import React, { Component } from 'react';
import { Button, Divider, Form, Grid, Header, Message, Segment, Select } from 'semantic-ui-react';
import KeysConfirm from './Confirm';
import { hiveAuth } from '../../utils/hiveApi';

const permissionOptions = [
  {
    key: 'owner',
    text: 'Owner',
    value: 'owner',
  },
  {
    key: 'active',
    text: 'Active',
    value: 'active',
  },
  {
    key: 'posting',
    text: 'Posting',
    value: 'posting',
  },
];

export default class KeysLogin extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state.errors = this.validate(this.state);
  }

  state = {
    account: '',
    password: '',
    permission: 'active',
    lock1: '',
    lock2: '',
    errors: {
      account_name_required: false,
      password_error_not_set: false,
      password_error_no_match: false,
      wif_error_invalid: false,
    },
  };

  handleConfirmAction = (e: any, data: any) => {
    const confirmed = data.value;
    e.preventDefault();
    if (confirmed) {
      const { account, password, permission, lock1 } = this.state;
      const { addKeyConfirmed } = this.props.actions;
      const keys = hiveAuth.getPrivateKeys(account, password, [permission]);
      const wif = keys[permission];
      // §5.1 — the wallet password is mandatory; the key is always encrypted.
      addKeyConfirmed(account, wif, permission, lock1);
    } else {
      this.props.actions.addKeyCancel();
    }
  };

  handleChange = (e: any, { name, value }: any) => {
    const newState = { ...this.state, [name]: value };
    newState.errors = this.validate(newState);
    this.setState(newState);
  };

  handleSelectChange = (e, data) => {
    const { name, value } = data;
    const newState = { ...this.state, [name]: value };
    newState.errors = this.validate(newState);
    this.setState(newState);
  };

  validate = (newState) => {
    const errors: any = {};
    const { lock1, lock2 } = newState;
    // Password is now mandatory (§5.1 — no unencrypted opt-out).
    errors.password_error_not_set = !lock1 || !lock2 || lock1 === '' || lock2 === '';
    errors.password_error_no_match = lock1 !== lock2;
    errors.account_name_required = !newState.account || newState.account === '';
    return errors;
  };

  hasErrors = () => {
    const { errors } = this.state;
    return !!Object.keys(errors).filter((error) => errors[error]).length;
  };

  handleSubmit = (e: any) => {
    e.preventDefault();
    const { addKey } = this.props.actions;
    const { account, password, permission } = this.state;
    const keys = hiveAuth.getPrivateKeys(account, password, [permission]);
    const wif = keys[permission];
    addKey(account, wif);
  };

  render() {
    const { account, password, permission, lock1, lock2 } = this.state;
    const confirmAccount = this.props.keys.confirm;
    const { errors } = this.state;
    const hasErrors = this.hasErrors();
    const messages = {
      account_name_required: 'An existing account name is required.',
      password_error_not_set: 'You must set a wallet password to encrypt your keys.',
      password_error_no_match: 'The passwords you have entered do not match.',
      wif_error_invalid: 'They WIF Private Key you have entered is invalid.',
    };
    let handleMethodReset: any = false;
    if (this.props.handleMethodReset) {
      handleMethodReset = (
        <Segment basic textAlign="center">
          <Button
            size="large"
            color="red"
            content="Cancel"
            onClick={this.props.handleMethodReset}
          />
        </Segment>
      );
    }
    const passwordWarning = false;
    const encryptionWarning = (
      <Message
        header="Notice about Encryption"
        content="The wallet password if only used to unlock Vessel during transactions. If you lose your password, you will be unable to recover your keys. Please make sure to back up your keys and remember your password."
      />
    );
    let message: any = false;
    let warning: any = false;
    if (hasErrors || this.props.keys.lastError) {
      if (this.props.keys.lastError) {
        message = this.props.keys.lastError;
      }
      if (errors.password_error_not_set) {
        message = messages.password_error_not_set;
      }
      if (errors.password_error_no_match) {
        message = messages.password_error_no_match;
      }
      if (errors.wif_error_invalid) {
        message = messages.wif_error_invalid;
      }
      if (errors.account_name_required) {
        message = messages.account_name_required;
      }
      warning = <Message error icon="warning" content={message} />;
    }
    const passwordInput = (
      <div>
        <Form.Input
          label="Wallet Password"
          type="password"
          name="lock1"
          value={lock1}
          onChange={this.handleChange}
        />
        <Form.Input
          label="Wallet Password (Repeat)"
          type="password"
          name="lock2"
          value={lock2}
          onChange={this.handleChange}
        />
      </div>
    );
    let display = (
      <Form
        error={hasErrors || this.props.keys.lastError}
        loading={this.props.processing.account_loading}
      >
        <Grid divided>
          <Grid.Row>
            <Grid.Column width={8}>
              <Form.Input
                label="Hive Account Name"
                name="account"
                value={account}
                onChange={this.handleChange}
              />
              <Form.Input
                label="Hive Password"
                type="password"
                name="password"
                value={password}
                onChange={this.handleChange}
              />
              <Form.Field
                control={Select}
                name="permission"
                value={permission}
                label="Permissions for Wallet"
                options={permissionOptions}
                onChange={this.handleSelectChange}
                placeholder="Specify permission for this wallet..."
              />
            </Grid.Column>
            <Grid.Column width={8}>
              {passwordInput}
              {encryptionWarning}
            </Grid.Column>
          </Grid.Row>
        </Grid>
        <Divider hidden />
        <Divider />
        {passwordWarning}
        {warning}
        <Button disabled={hasErrors} fluid size="large" color="green" onClick={this.handleSubmit}>
          Add to Wallet
        </Button>
        {handleMethodReset}
      </Form>
    );
    if (confirmAccount) {
      display = (
        <KeysConfirm handleConfirmAction={this.handleConfirmAction} encryptWallet {...this.props} />
      );
    }
    return display;
  }
}
