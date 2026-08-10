import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { Navigate } from 'react-router';
import { connect } from 'react-redux';
import { Header, Segment } from 'semantic-ui-react';
import Settings from '../components/Settings';
import MenuBar from './MenuBar';
import ContentBar from '../components/ContentBar';
import * as AccountActions from '../actions/account';
import * as PreferencesActions from '../actions/preferences';

class SettingsPage extends Component<any, any> {
  render() {
    if (!this.props.keys.isUser) {
      return <Navigate to="/" replace />;
    }
    return (
      <ContentBar>
        <Segment padded attached secondary>
          <Header
            icon="settings"
            content="Wallet Settings"
            subheader="Configuration for Vessel wallets."
          />
        </Segment>
        <Settings {...this.props} />
        <MenuBar />
      </ContentBar>
    );
  }
}

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
        ...AccountActions,
        ...PreferencesActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SettingsPage);
