import { hiveApi, hiveConfig } from '../utils/hiveApi';
import * as ProcessingActions from './processing';

export const HIVE_GLOBALPROPS_UPDATE = 'HIVE_GLOBALPROPS_UPDATE';
export const HIVE_GLOBALPROPS_UPDATE_RESOLVED = 'HIVE_GLOBALPROPS_UPDATE_RESOLVED';

export function refreshGlobalProps() {
  return (dispatch: any) => {
    hiveApi.getDynamicGlobalProperties().then((results: any) => {
      if (results.virtual_supply.search('HIVE') >= 0) {
        if (
          hiveConfig.get('chain_id') ===
          'beeab0de00000000000000000000000000000000000000000000000000000000'
        ) {
          results.network = 'Hive';
        } else {
          results.network = 'Hive Mirrornet';
        }
      } else if (results.virtual_supply.search('TESTS') >= 0) {
        results.network = 'Hive Testnet';
      } else {
        results.network = 'Unknown';
      }

      dispatch({
        type: HIVE_GLOBALPROPS_UPDATE_RESOLVED,
        payload: results,
      });
    }, () => {});
  };
}
