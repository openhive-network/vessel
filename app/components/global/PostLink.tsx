import React, { Component } from 'react';

export default class PostLink extends Component<any, any> {
  handleLink = () => {
    const { author, permlink } = this.props;
    window.electronAPI?.openExternal(
      `https://hive.blog/category/@${encodeURIComponent(author)}/${encodeURIComponent(permlink)}`
    );
  };

  render() {
    const { author, permlink } = this.props;
    return (
      <a onClick={this.handleLink}>
        {author}/{permlink}
      </a>
    );
  }
}
