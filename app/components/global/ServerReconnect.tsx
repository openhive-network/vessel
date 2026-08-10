import React, { Component } from 'react';

import { Button } from 'semantic-ui-react';

export default class ServerReconnect extends Component<any, any> {
  selectServer = (e, data) => {
    const { refreshGlobalProps } = this.props.actions;
    refreshGlobalProps();
  };

  render() {
    return <Button floated="right" color="yellow" content="Reconnect" />;
  }
}
