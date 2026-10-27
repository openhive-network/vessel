/**
 * @jest-environment jsdom
 */
import rootReducer from '../../app/reducers';
import { setPreference } from '../../app/actions/preferences';

describe('root reducer', () => {
  it('combines every slice of the store', () => {
    const state = rootReducer(undefined, { type: '@@INIT' });
    expect(Object.keys(state).sort()).toEqual(
      ['account', 'hive', 'intl', 'keys', 'preferences', 'processing', 'router']
    );
    expect(state.preferences.hived_node).toBe('https://api.hive.blog');
  });

  it('routes a preference change to the preferences slice', () => {
    const state = rootReducer(undefined, setPreference('hived_node', 'https://api.example.org'));
    expect(state.preferences.hived_node).toBe('https://api.example.org');
  });
});
