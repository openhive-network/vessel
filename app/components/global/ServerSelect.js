// @flow
import React, { Component } from 'react';

import { Button, Header, Modal, Segment, Table } from 'semantic-ui-react';

// Kept in sync with hive-tx's shipped, maintained config.nodes (api.hive.blog stays the default; node
// selection pins hive-tx to the chosen one via hiveApi.setOptions -> config.nodes = [selected]).
const servers = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://api.openhive.network',
  'https://rpc.mahdiyari.info',
  'https://techcoderx.com',
  'https://hiveapi.actifit.io',
  'https://api.c0ff33a.uk',
];

export default class ServerSelect extends Component {
  state = {
    loading: false,
    open: false,
    servers: {},
  };

  startStatus = () => {
    this.setState({ open: true });
    this.interval = setInterval(this.checkStatus.bind(this), 15000);
    this.checkStatus();
  };

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  stopStatus = () => {
    clearInterval(this.interval);
    this.setState({ loading: false, open: false });
  };

  selectServer = (e, data) => {
    const server = data.value;
    const { refreshGlobalProps, setPreference } = this.props.actions;
    clearInterval(this.interval);
    this.setState({ loading: true, open: false });
    setPreference('hived_node', server);
    refreshGlobalProps();
  };

  checkStatus = () => {
    servers.forEach((server) => {
      try {
        // TODO: Fix
        // get dynamic global properties
        // const client = new Client(server);
        // client.database.getDynamicGlobalProperties().then((props) => {
        //   let servers = Object.assign({}, this.state.servers);
        //   servers[server.replace('wss', 'https')] = props.time;
        //   this.setState({servers});
        // });
      } catch (e) {
        console.log(e);
      }
    });
  };

  render() {
    const { name } = this.props;
    const { servers } = this.state;
    const current = Object.keys(servers).map((server) => (
      <Table.Row>
        <Table.Cell>{server}</Table.Cell>
        <Table.Cell>{servers[server]}</Table.Cell>
        <Table.Cell collapsing>
          <Button primary onClick={this.selectServer} value={server}>
            Connect
          </Button>
        </Table.Cell>
      </Table.Row>
    ));
    return (
      <Modal
        closeIcon
        color="black"
        size="large"
        loading={this.state.loading}
        onOpen={this.startStatus}
        onClose={this.stopStatus}
        open={this.state.open}
        trigger={<Button floated="right" color="red" content="Change Servers" />}
      >
        <Header attached="top">Select a Hive server to connect to:</Header>
        <Segment loading={this.state.loading}>
          <Table attached="bottom">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Server</Table.HeaderCell>
                <Table.HeaderCell>Last Block</Table.HeaderCell>
                <Table.HeaderCell>Controls</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>{current}</Table.Body>
          </Table>
        </Segment>
      </Modal>
    );
  }
}
