// @flow
import React, { Component } from 'react';

export default class AccountAvatar extends Component {
  handleLink = () => {
    const { name } = this.props;
    window.electronAPI?.openExternal(`https://hive.blog/@${encodeURIComponent(name)}`);
  };

  render() {
    const { name } = this.props;
    return (
      <a
        onClick={this.handleLink}
        style={{
          backgroundImage: `url(https://steemitimages.com/u/${name || 'steemit'}/avatar/medium)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          display: 'inline-block',
          height: '96px',
          width: '96px',
        }}
      />
    );
  }
}
