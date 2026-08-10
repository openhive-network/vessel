import React, { useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { hiveApi, hiveConfig } from './utils/hiveApi';
import parse from 'url-parse';

import { useAppSelector, useAppDispatch } from './hooks/redux';
import * as HiveActions from './actions/hive';

import AppContainer from './containers/AppContainer';
import AdvancedPage from './containers/AdvancedPage';
import AccountsPage from './containers/AccountsPage';
import DebugPage from './containers/DebugPage';
import PromptOperation from './containers/PromptOperation';
import SettingsPage from './containers/SettingsPage';
import SendPage from './containers/SendPage';
import TransactionsPage from './containers/TransactionsPage';
import WelcomePage from './containers/WelcomePage';
import VestingPage from './containers/VestingPage';
import ConvertPage from './containers/ConvertPage';
import DecryptPrompt from './containers/DecryptPrompt';

const isURL = (str: string): boolean => {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$',
    'i'
  ); // fragment locator
  return pattern.test(str);
};

const changeNode = (url: string, refreshGlobalProps: () => void): void => {
  if (url && isURL(url)) {
    // If it's a valid URL, set
    hiveApi.setOptions({ url });
    hiveApi.getConfig().then((result: any) => {
      if (result) {
        hiveConfig.set('chain_id', result.HIVE_CHAIN_ID);
        hiveConfig.set('address_prefix', result.HIVE_ADDRESS_PREFIX);
      }
    }, () => {});
  } else {
    // Otherwise set to the api.hive.blog node
    hiveApi.setOptions({ url: 'https://api.hive.blog' });
  }
  // Force a refresh immediately after change
  refreshGlobalProps();
};

const AppRoutes: React.FC = () => {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences);
  const keys = useAppSelector((state) => state.keys);
  const prevNodeRef = useRef<string | undefined>(preferences?.hived_node);

  const refreshGlobalProps = () => {
    dispatch(HiveActions.refreshGlobalProps());
  };

  // Initial node setup on mount
  useEffect(() => {
    if (preferences?.hived_node) {
      changeNode(preferences.hived_node, refreshGlobalProps);
    }
  }, []);

  // Handle node changes
  useEffect(() => {
    const currentNode = preferences?.hived_node;
    if (currentNode !== prevNodeRef.current) {
      changeNode(currentNode || '', refreshGlobalProps);
      prevNodeRef.current = currentNode;
    }
  }, [preferences?.hived_node]);

  const parsed = parse(window.location.href, true);
  if (parsed?.query?.action === 'promptOperation') {
    return (
      <AppContainer>
        <DecryptPrompt />
        <PromptOperation query={parsed.query} />
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <DecryptPrompt />
      <Routes>
        <Route path="/" element={keys?.isUser ? <TransactionsPage /> : <WelcomePage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="/send" element={<SendPage />} />
        <Route path="/convert" element={<ConvertPage />} />
        <Route path="/vesting" element={<VestingPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/advanced" element={<AdvancedPage />} />
      </Routes>
    </AppContainer>
  );
};

export default AppRoutes;
