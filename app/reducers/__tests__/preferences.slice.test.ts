import reducer from '../preferences';
import { SET_PREFERENCE, setPreference } from '../../actions/preferences';

describe('preferences reducer', () => {
  it('returns the initial state (default hived_node) on init', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ hived_node: 'https://api.hive.blog' });
  });

  it('sets a new preference key while preserving existing ones', () => {
    const prevState = { hived_node: 'https://api.hive.blog' };
    const nextState = reducer(prevState, {
      type: SET_PREFERENCE,
      payload: { key: 'theme', value: 'dark' },
    });

    expect(nextState).toEqual({
      hived_node: 'https://api.hive.blog',
      theme: 'dark',
    });
    // original state object must not be mutated
    expect(prevState).toEqual({ hived_node: 'https://api.hive.blog' });
  });

  it('overwrites an existing preference value for the same key', () => {
    const prevState = { hived_node: 'https://api.hive.blog' };
    const nextState = reducer(prevState, {
      type: SET_PREFERENCE,
      payload: { key: 'hived_node', value: 'https://custom.node' },
    });

    expect(nextState).toEqual({ hived_node: 'https://custom.node' });
  });

  it('accepts the action shape produced by the setPreference action creator', () => {
    const prevState = { hived_node: 'https://api.hive.blog' };
    const action = setPreference('locale', 'en-US');

    expect(action.type).toBe('SET_PREFERECE'); // legacy string constant (note: not "PREFERENCE")

    const nextState = reducer(prevState, action);
    expect(nextState).toEqual({
      hived_node: 'https://api.hive.blog',
      locale: 'en-US',
    });
  });

  it('ignores unrelated action types and returns the same state reference', () => {
    const prevState = { hived_node: 'https://api.hive.blog' };
    const nextState = reducer(prevState, { type: 'SOME_OTHER_ACTION' });
    expect(nextState).toBe(prevState);
  });
});
