import React, { Component } from 'react';

export default class AccountName extends Component<any, any> {
  handleLink = () => {
    const { name } = this.props;
    window.electronAPI?.openExternal(`https://hive.blog/@${encodeURIComponent(name)}`);
  };

  render() {
    const { name } = this.props;
    return <a onClick={this.handleLink}>{name}</a>;
  }
}
