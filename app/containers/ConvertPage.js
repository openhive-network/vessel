// @flow
import hive from "@hiveio/hive-js";
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { Redirect } from 'react-router';
import { connect } from 'react-redux';
import MenuBar from './MenuBar';
import ContentBar from '../components/ContentBar';
import {
  Header,
  Divider,
  Icon,
  Button,
  Checkbox,
  Grid,
  Label,
  Message,
  Modal,
  Radio,
  Segment,
  Select,
  Table
} from 'semantic-ui-react';
import * as AccountActions from '../actions/account';
import * as KeysActions from '../actions/keys';
import { Form, Input } from "formsy-semantic-ui-react";

const defaultState = {
  account: "",
  id: "",
  symbol: "HIVE",
  conversionType: 'HIVEtoHBD',
  requestid: null,
  generatedRequestId: null,
  amount: 0,
  modalPreview: false,
};


class ConvertPage extends Component {
  constructor(props) {
    super(props);
    this.state = Object.assign({}, defaultState, {
      account: props.keys.names[0],
      network: props.hive.props.network || "Hive"
    })
    if (props.keys.names[0]) this.handleAccountChange({ e: null }, { value: props.keys.names[0] })
  }
  render() {
    const accounts = this.props.account.accounts;
    const keys = this.props.keys;
    const availableFrom = keys.names.map(name => {
      const hasPermission =
        keys.permissions[name].type === "active" ||
        keys.permissions[name].type === "owner";
      return hasPermission
        ? {
          key: name,
          text: name,
          value: name
        }
        : {
          key: name,
          disabled: true,
          text: name + " (unavailable - active/owner key not loaded)"
        };
    });

    const getConversionExplanationField = () => {
      return this.state.conversionType === 'HIVEtoHBD' ? (
        <Grid.Column>
          <Header.Subheader>HIVE can be converted to HBD by using 2x the amount of HIVE as collateral + 5% fee. You'll receive the HBD instantly. After 3.5 days, you'll receive some of your HIVE collateral back. If the HIVE price remained stable or increased, you'll get back your collateral in full or even more. If the HIVE price decreased, you'll get back less collateral, since the HBD you received can now buy more HIVE.</Header.Subheader>
          <br />
          <Header.Subheader>When to use: If HBD can be sold for more than $1.05 on exchanges and the HIVE price over the next 3.5 days remains stable or increases in price.</Header.Subheader>
          <br />
          <Header.Subheader>NOTE: This conversion is risky. Please make sure you know what you're doing!</Header.Subheader>
        </Grid.Column>) : (<Grid.Column><Header.Subheader>HBD can be converted into $1 USD worth of HIVE determined by the 3.5 days median price. You'll receive your HIVE after 3.5 days.</Header.Subheader>
          <br />
          <Header.Subheader>When to use: If HBD can be bought for less than $1 on exchanges and the HIVE price over the next 3.5 days remains stable or falls in price.</Header.Subheader></Grid.Column>)
    }


    const conversionExplanationField = getConversionExplanationField()


    const availableAmount = { HBD: accounts[this.state.account].hbd_balance, HIVE: accounts[this.state.account].balance }

    const errorLabel = <Label color="red" pointing />;
    let modal = false;
    if (!this.props.keys.isUser) {
      return <Redirect to="/" />;
    }

    if (this.state.modalPreview) {
      modal = (
        <Modal
          open
          header="Please confirm the details of this transaction"
          autoFocus={true}
          content={
            <Segment basic padded>
              <p>
                Ensure that all of the data below looks correct before
                continuing. If you mistakenly send to the wrong accout (or with
                the wrong memo) you may lose funds.
              </p>
              <Table
                definition
                collapsing
                style={{ minWidth: "300px", margin: "0 auto" }}
              >
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell textAlign="right">Field</Table.HeaderCell>
                    <Table.HeaderCell>Value</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  <Table.Row>
                    <Table.Cell textAlign="right">Conversion</Table.Cell>
                    <Table.Cell>{this.state.conversionType.replace('to', ' to ')}</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell textAlign="right">Owner:</Table.Cell>
                    <Table.Cell>
                      {this.state.account}
                    </Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell textAlign="right">Amount</Table.Cell>
                    <Table.Cell>
                      {`${this.state.amount} ${this.state.conversionType === 'HIVEtoHBD' ? 'HIVE' : 'HBD'}`}
                    </Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell textAlign="right">Request Id</Table.Cell>
                    <Table.Cell>{this.state.requestid || this.state.generatedRequestId}</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
            </Segment>
          }
          actions={[
            {
              key: "no",
              icon: "cancel",
              content: "Cancel",
              color: "red",
              floated: "left",
              onClick: this.handleCancel,
              disabled: this.state.conversionType === 'HIVEtoHBD' ? this.props.processing.account_collateralized_convert_pending : this.props.processing.account_convert_pending
            },
            {
              key: "yes",
              icon: "checkmark",
              content: "Confirmed - this is correct",
              color: "green",
              onClick: this.handleConfirm,
              disabled: this.state.conversionType === 'HIVEtoHBD' ? this.props.processing.account_collateralized_convert_pending : this.props.processing.account_convert_pending
            }
          ]}
        />
      );
    }
    return (
      <ContentBar>
        <Form
          error={!!this.props.processing.account_transfer_error}
          loading={this.props.processing.account_transfer_pending}
        >
          {modal}
          <Segment padded attached secondary>
            <Header>
              <Grid.Row style={{ display: 'flex' }}>
                <Icon size="large" name="exchange" style={{ display: 'inline-block' }} />
                <Grid.Row style={{ display: 'flex', marginLeft: '15px' }}>
                  <Form.Field
                    control={Radio}
                    name="conversionType"
                    label="Convert HIVE to HBD"
                    value="HIVEtoHBD"
                    checked={this.state.conversionType === "HIVEtoHBD"}
                    onChange={this.handleConversionTypeChange}
                    style={{ marginRight: '10px' }}
                  />
                  <Form.Field
                    control={Radio}
                    name="conversionType"
                    label="Convert HBD to HIVE"
                    value="HBDtoHIVE"
                    checked={this.state.conversionType === "HBDtoHIVE"}
                    onChange={this.handleConversionTypeChange}
                  />
                </Grid.Row>
              </Grid.Row>
              <Divider />
              <Grid.Column width={12}>{conversionExplanationField}</Grid.Column>
            </Header>
          </Segment>

          <Segment ui basic padded>
            <Grid.Row>
              <Grid.Column width={12}>
                <Form.Field
                  control={Select}
                  value={this.state.account}
                  name="account"
                  label="Select a loaded account"
                  options={availableFrom}
                  placeholder="Sending Account..."
                  onChange={this.handleAccountChange}
                />
              </Grid.Column>
            </Grid.Row>
            <Grid.Column width={12} style={{ marginTop: '15px' }}>
              <div className="field">
                <label htmlFor="amount">
                  Amount of {this.state.symbol} to Convert
                </label>
                <Form.Field
                  control={Input}
                  name="amount"
                  placeholder="Enter the amount to convert..."
                  value={this.state.amount}
                  onChange={this.handleAmountChange}
                  validationErrors={{
                    isNumeric: "The amount must be a number"
                  }}
                  errorLabel={errorLabel}
                />
              </div>
              <p>
                <a
                  onClick={this.setAmountMaximum}
                  style={{
                    color: "black",
                    cursor: "pointer",
                    fontWeight: "bold",
                    textDecoration: "underline"
                  }}
                >
                  {availableAmount[this.state.symbol]}
                </a>{" "}
                available
              </p>
            </Grid.Column>

            <Grid.Column width={12} style={{ marginTop: '15px' }}>
              <div className="field">
                <label htmlFor="requestid">
                  Request Id (optional)
                </label>
                <Form.Field
                  control={Input}
                  name="requestid"
                  placeholder="Enter your preferred request ID. Will be generated automatically. Example: 1"
                  value={this.state.requestid}
                  onChange={this.handleRequestIDChange}
                  validationErrors={{
                    isNumeric: "The amount must be a number"
                  }}
                  errorLabel={errorLabel}
                />
              </div>
            </Grid.Column>


            <MenuBar />
            <Grid.Row style={{ marginTop: '10px', display: 'flex', justifyContent: 'center  ' }}>
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
          </Segment>
        </Form>

      </ContentBar >
    );
  }

  handleRequestIDChange = (e: SyntheticEvent, { value }: { value: any }) => {
    this.setState({
      requestid: value,
    });
  };

  handleAccountChange = (e: SyntheticEvent, { value }: { value: any }) => {
    this.setState({
      account: value,
    });

    // TODO: enable to fetch conversions
    // console.log('account', this.state.account, value)
    // hive.api.getConversionRequests(value, function (err, result) {
    //   console.log('conversions', err, result);
    // })

  };

  handleAmountChange = (e: SyntheticEvent, { value }: { value: any }) => {
    const cleaned = value.replace(/[a-z\s]+/gim, "");
    this.setState({ amount: cleaned });
  };

  setAmountMaximum = (e: SyntheticEvent) => {
    const accounts = this.props.account.accounts;
    const { account, symbol } = this.state;
    let field = symbol === "HBD" ? "hbd_balance" : "balance";
    const amount = accounts[account][field].split(" ")[0];
    this.setState({ amount });
  };

  handleConversionTypeChange = (e: SyntheticEvent, { value }: { value: any }) => {
    this.setState({
      conversionType: value,
      symbol: value === 'HIVEtoHBD' ? 'HIVE' : 'HBD'
    });
  };


  isFormValid = () => {
    return true
  };

  handlePreview = (e: SyntheticEvent) => {
    if (this.isFormValid()) {

      this.setState({
        generatedRequestId: Math.floor(Date.now() / 1000),
        modalPreview: true
      });
    } else {
      console.log("form not valid");
    }
    e.preventDefault();
  };

  handleCancel = (e: SyntheticEvent) => {
    this.setState({
      modalPreview: false
    });
    e.preventDefault();
  };

  handleConfirm = (e: SyntheticEvent) => {
    var { account, conversionType, requestid, generatedRequestId, amount } = this.state;
    // symbol = symbol.replace("HIVE","STEEM");
    // symbol = symbol.replace("HBD","SBD");
    amount = parseFloat(amount).toFixed(3);
    const amountFormat = [amount, conversionType === "HIVEtoHBD" ? 'HIVE' : 'HBD'].join(" ");

    this.props.actions.useKey(
      conversionType === "HIVEtoHBD" ? 'collateralizedConvert' : 'convert',
      { owner: account, amount: amountFormat, requestid: requestid || generatedRequestId },
      this.props.keys.permissions[account]
    );
    this.setState({
      modalPreview: false
    });
    e.preventDefault();
  };
}

function mapStateToProps(state) {
  return {
    account: state.account,
    keys: state.keys,
    preferences: state.preferences,
    processing: state.processing,
    hive: state.hive
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators({
      ...AccountActions,
      ...KeysActions
    }, dispatch)
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(ConvertPage);
