// @flow
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Message, Modal, Segment } from 'semantic-ui-react';
import { Form, Input } from 'formsy-semantic-ui-react'

import * as KeysActions from '../actions/keys';

const defaultState = {
  password: '',
  unlocking: false,
};

class DecryptPrompt extends Component {

  constructor(props) {
    super(props);
    this.state = defaultState;
  }

  handleKeyUp = (e) => {
    if (this.state.password && !this.state.unlocking && e.key == 'Enter') {
      this.handleSubmit(e);
    }
  }

  handlePasswordChange = (e: SyntheticEvent, { value }: { value: string }) => {
    this.setState({ password: value });
  }

  handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const { operation, params, auth } = this.props.keys.decrypt;
    const { password } = this.state;
    this.setState({ unlocking: true });
    // On success the prompt closes; on failure it stays open with the error.
    await this.props.actions.unlockKey(operation, params, auth, password);
    this.setState(defaultState);
  }

  handleCancel = (e: SyntheticEvent) => {
    // Close the prompt
    this.props.actions.useKeyRequestDecryptClose();
    // Reset to the default state
    this.setState(defaultState);
  }

  render() {
    let prompt = false;
    const decrypt = this.props.keys.decrypt;
    if (decrypt) {
      prompt = (
        <Modal
          size="small"
          open
          header="Decrypt Wallet to Broadcast Transaction"
          onOpen={this.focusInput}
          content={
            <Segment padded basic>
              <p>
                The wallet requested is encrypted locally. Please type your wallet password to broadcast the transaction to the blockchain.
              </p>
              {(decrypt.error)
                ? <Message error content={decrypt.error} />
                : false
              }
              <Form>
                <Input
                  name="password"
                  type="password"
                  focus
                  autoFocus
                  placeholder="Enter wallet password"
                  value={this.state.password}
                  onChange={this.handlePasswordChange}
                  onKeyUp={this.handleKeyUp}
                />
              </Form>
            </Segment>
          }
          actions={[
            {
              key: 'no',
              content: 'Cancel Operation',
              floated: 'left',
              color: 'red',
              onClick: this.handleCancel
            },
            {
              key: 'yes',
              type: 'submit',
              content: 'Unlock + Broadcast',
              color: 'purple',
              onClick: this.handleSubmit,
              loading: this.state.unlocking,
              disabled: !this.state.password || this.state.unlocking
            }
          ]}
        />
      );
    }
    return prompt;
  }
}

function mapStateToProps(state) {
  return {
    keys: state.keys
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators({
      ...KeysActions
    }, dispatch)
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(DecryptPrompt);
