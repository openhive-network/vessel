import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import Welcome from '../components/Welcome';
import * as KeyActions from '../actions/keys';
import * as PreferencesActions from '../actions/preferences';

function WelcomePage(props: any) {
  return (
    <div>
      <Welcome {...props} />
    </div>
  );
}

function mapStateToProps(state: any) {
  return {
    account: state.account,
    keys: state.keys,
    processing: state.processing,
    preferences: state.preferences,
  };
}

function mapDispatchToProps(dispatch: any) {
  return {
    actions: bindActionCreators(
      {
        ...KeyActions,
        ...PreferencesActions,
      } as any,
      dispatch
    ),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(WelcomePage);
