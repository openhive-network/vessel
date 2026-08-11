import React from 'react';
import { bindActionCreators } from 'redux';
import { Navigate } from 'react-router';
import { connect } from 'react-redux';
import { Button, Table } from '@mantine/core';

import MenuBar from './MenuBar';
import ContentBar from '../components/ContentBar';

import * as PreferencesActions from '../actions/preferences';
import * as KeysActions from '../actions/keys';

const DebugPage: React.FC<any> = (props) => {
  const send = (account: any) => {
    const { permissions } = props.keys;
    props.actions.useKey(
      'transfer',
      {
        from: 'webdev',
        to: 'webdev',
        amount: '0.001 HIVE',
        memo: '',
      },
      permissions[account]
    );
  };

  const accounts = Object.keys(props.keys.permissions);
  const { permissions } = props.keys;
  if (!props.keys.isUser) {
    return <Navigate to="/" replace />;
  }
  return (
    <ContentBar>
      <Table withTableBorder withColumnBorders>
        <Table.Tbody>
          {accounts.map((account) => (
            <Table.Tr key={account}>
              <Table.Td>{account}</Table.Td>
              <Table.Td>
                <Button onClick={() => send(account)}>Send</Button>
              </Table.Td>
              <Table.Td>{permissions[account].encrypted ? 'True' : 'False'}</Table.Td>
              <Table.Td>{permissions[account].type}</Table.Td>
              <Table.Td>{permissions[account].key}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <MenuBar />
    </ContentBar>
  );
};

function mapStateToProps(state: any) {
  return {
    account: state.account,
    keys: state.keys,
    preferences: state.preferences,
  };
}

function mapDispatchToProps(dispatch: any) {
  return {
    actions: bindActionCreators(
      {
        ...KeysActions,
        ...PreferencesActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(DebugPage);
