import React, { Component } from 'react';

export default class ContentBar extends Component<any, any> {
  render() {
    return (
      <div
        style={{
          marginLeft: '92px',
        }}
      >
        {this.props.children}
      </div>
    );
  }
}
