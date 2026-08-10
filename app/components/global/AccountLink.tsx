import React, { Component } from 'react';

export default class AccountLink extends Component<any, any> {
  handleLink = () => {
    const { name } = this.props;
    window.electronAPI?.openExternal(`https://hive.blog/@${encodeURIComponent(name)}`);
  };

  render() {
    const { name, content } = this.props;
    return <a onClick={this.handleLink}>{content}</a>;
  }
}
