import React, { useState } from 'react';
import { bindActionCreators } from 'redux';
import { Navigate } from 'react-router';
import { connect } from 'react-redux';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Divider,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  Radio,
  Select,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconArrowsExchange, IconCheck, IconX } from '@tabler/icons-react';
import MenuBar from './MenuBar';
import ContentBar from '../components/ContentBar';
import * as AccountActions from '../actions/account';
import * as KeysActions from '../actions/keys';

const ConvertPage: React.FC<any> = (props) => {
  const { keys } = props;
  const { accounts } = props.account;

  const [account, setAccount] = useState<any>(keys.names[0]);
  const [symbol, setSymbol] = useState<any>('HIVE');
  const [conversionType, setConversionType] = useState<any>('HIVEtoHBD');
  const [requestid, setRequestid] = useState<any>(null);
  const [generatedRequestId, setGeneratedRequestId] = useState<any>(null);
  const [amount, setAmount] = useState<any>(0);
  const [modalPreview, setModalPreview] = useState(false);

  const handleAccountChange = (value: any) => {
    if (value) setAccount(value);
  };

  const handleAmountChange = (e: any) => {
    const cleaned = e.currentTarget.value.replace(/[a-z\s]+/gim, '');
    setAmount(cleaned);
  };

  const handleRequestIDChange = (e: any) => {
    setRequestid(e.currentTarget.value);
  };

  const setAmountMaximum = () => {
    const field = symbol === 'HBD' ? 'hbd_balance' : 'balance';
    setAmount(accounts[account][field].split(' ')[0]);
  };

  const handleConversionTypeChange = (value: any) => {
    setConversionType(value);
    setSymbol(value === 'HIVEtoHBD' ? 'HIVE' : 'HBD');
  };

  const isFormValid = () => true;

  const handlePreview = (e: any) => {
    if (isFormValid()) {
      setGeneratedRequestId(Math.floor(Date.now() / 1000));
      setModalPreview(true);
    }
    e.preventDefault();
  };

  const handleCancel = (e?: any) => {
    setModalPreview(false);
    if (e && e.preventDefault) e.preventDefault();
  };

  const handleConfirm = (e: any) => {
    // symbol = symbol.replace("HIVE","STEEM");
    // symbol = symbol.replace("HBD","SBD");
    const fixedAmount = parseFloat(amount).toFixed(3);
    const amountFormat = [fixedAmount, conversionType === 'HIVEtoHBD' ? 'HIVE' : 'HBD'].join(' ');

    props.actions.useKey(
      conversionType === 'HIVEtoHBD' ? 'collateralizedConvert' : 'convert',
      { owner: account, amount: amountFormat, requestid: requestid || generatedRequestId },
      props.keys.permissions[account]
    );
    setModalPreview(false);
    e.preventDefault();
  };

  if (!keys.isUser) {
    return <Navigate to="/" replace />;
  }

  const availableFrom = keys.names.map((name: any) => {
    const hasPermission =
      keys.permissions[name].type === 'active' || keys.permissions[name].type === 'owner';
    return hasPermission
      ? { value: name, label: name }
      : {
          value: name,
          disabled: true,
          label: `${name} (unavailable - active/owner key not loaded)`,
        };
  });

  const conversionExplanationField =
    conversionType === 'HIVEtoHBD' ? (
      <Box>
        <Text size="sm" c="dimmed">
          HIVE can be converted to HBD by using 2x the amount of HIVE as collateral + 5% fee. You'll
          receive the HBD instantly. After 3.5 days, you'll receive some of your HIVE collateral
          back. If the HIVE price remained stable or increased, you'll get back your collateral in
          full or even more. If the HIVE price decreased, you'll get back less collateral, since the
          HBD you received can now buy more HIVE.
        </Text>
        <br />
        <Text size="sm" c="dimmed">
          When to use: If HBD can be sold for more than $1.05 on exchanges and the HIVE price over
          the next 3.5 days remains stable or increases in price.
        </Text>
        <br />
        <Text size="sm" c="dimmed">
          NOTE: This conversion is risky. Please make sure you know what you're doing!
        </Text>
      </Box>
    ) : (
      <Box>
        <Text size="sm" c="dimmed">
          HBD can be converted into $1 USD worth of HIVE determined by the 3.5 days median price.
          You'll receive your HIVE after 3.5 days.
        </Text>
        <br />
        <Text size="sm" c="dimmed">
          When to use: If HBD can be bought for less than $1 on exchanges and the HIVE price over the
          next 3.5 days remains stable or falls in price.
        </Text>
      </Box>
    );

  const availableAmount: any = {
    HBD: accounts[account].hbd_balance,
    HIVE: accounts[account].balance,
  };

  const convertError = props.processing.account_convert_error;
  const collateralizedConvertError = props.processing.account_collateralized_convert_error;
  const err = collateralizedConvertError || convertError;

  const pending =
    conversionType === 'HIVEtoHBD'
      ? props.processing.account_collateralized_convert_pending
      : props.processing.account_convert_pending;

  const overlayPending =
    props.processing.account_convert_pending ||
    props.processing.account_collateralized_convert_pending;

  return (
    <ContentBar>
      <Box pos="relative">
        <LoadingOverlay visible={overlayPending} />

        {modalPreview && (
          <Modal
            opened
            onClose={handleCancel}
            title="Please confirm the details of this transaction"
          >
            <Box pos="relative">
              <LoadingOverlay visible={pending} />
              <Text>
                Ensure that all of the data below looks correct before continuing. If you mistakenly
                send to the wrong accout (or with the wrong memo) you may lose funds.
              </Text>
              <Table style={{ minWidth: '300px', margin: '0 auto' }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ textAlign: 'right' }}>Field</Table.Th>
                    <Table.Th>Value</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td style={{ textAlign: 'right' }}>Conversion</Table.Td>
                    <Table.Td>{conversionType.replace('to', ' to ')}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td style={{ textAlign: 'right' }}>Owner:</Table.Td>
                    <Table.Td>{account}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td style={{ textAlign: 'right' }}>Amount</Table.Td>
                    <Table.Td>
                      {`${amount} ${conversionType === 'HIVEtoHBD' ? 'HIVE' : 'HBD'}`}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td style={{ textAlign: 'right' }}>Request Id</Table.Td>
                    <Table.Td>{requestid || generatedRequestId}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
              {err && (
                <Alert color="red" title="Operation Error" mt="md">
                  {err}
                </Alert>
              )}
              <Group justify="space-between" mt="md">
                <Button
                  color="red"
                  leftSection={<IconX size={15} />}
                  onClick={handleCancel}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  color="green"
                  leftSection={<IconCheck size={15} />}
                  onClick={handleConfirm}
                  disabled={pending}
                >
                  Confirmed - this is correct
                </Button>
              </Group>
            </Box>
          </Modal>
        )}

        <Paper p="md" withBorder>
          <Group>
            <IconArrowsExchange size={28} />
            <Radio.Group value={conversionType} onChange={handleConversionTypeChange}>
              <Group>
                <Radio value="HIVEtoHBD" label="Convert HIVE to HBD" />
                <Radio value="HBDtoHIVE" label="Convert HBD to HIVE" />
              </Group>
            </Radio.Group>
          </Group>
          <Divider my="md" />
          {conversionExplanationField}
        </Paper>

        <Box p="md">
          <Select
            label="Select a loaded account"
            placeholder="Sending Account..."
            value={account}
            data={availableFrom}
            onChange={handleAccountChange}
          />

          <Box mt="md">
            <TextInput
              name="amount"
              label={`Amount of ${symbol} to Convert`}
              placeholder="Enter the amount to convert..."
              value={amount}
              onChange={handleAmountChange}
            />
            <Text mt="xs">
              <Anchor
                onClick={setAmountMaximum}
                style={{ fontWeight: 'bold', textDecoration: 'underline' }}
              >
                {availableAmount[symbol]}
              </Anchor>{' '}
              available
            </Text>
          </Box>

          <Box mt="md">
            <TextInput
              name="requestid"
              label="Request Id (optional)"
              placeholder="Enter your preferred request ID. Will be generated automatically. Example: 1"
              value={requestid || ''}
              onChange={handleRequestIDChange}
            />
          </Box>

          <MenuBar />

          <Group justify="center" mt="md">
            <Box ta="center">
              {err && (
                <Alert color="red" title="Operation Error" mb="md">
                  {err}
                </Alert>
              )}
              <Button color="grape" onClick={handlePreview}>
                Preview Transaction
              </Button>
            </Box>
          </Group>
        </Box>
      </Box>
    </ContentBar>
  );
};

function mapStateToProps(state: any) {
  return {
    account: state.account,
    keys: state.keys,
    preferences: state.preferences,
    processing: state.processing,
    hive: state.hive,
  };
}

function mapDispatchToProps(dispatch: any) {
  return {
    actions: bindActionCreators(
      {
        ...AccountActions,
        ...KeysActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(ConvertPage);
