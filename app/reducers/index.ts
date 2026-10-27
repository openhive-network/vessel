import { combineReducers } from 'redux';

import account from './account';
import keys from './keys';
import preferences from './preferences';
import processing from './processing';
import hive from './hive';

const rootReducer = combineReducers({
  account,
  keys,
  preferences,
  processing,
  hive,
});

export default rootReducer;
