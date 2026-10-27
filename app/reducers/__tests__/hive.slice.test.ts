import { describe, it, expect } from 'vitest';
import reducer from '../hive';
import { HIVE_GLOBALPROPS_UPDATE_RESOLVED } from '../../actions/hive';

describe('hive reducer', () => {
  it('returns the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({
      props: {
        time: null,
      },
    });
  });

  it('replaces props wholesale on HIVE_GLOBALPROPS_UPDATE_RESOLVED', () => {
    const prevState = {
      props: {
        time: null,
      },
    };

    const payload = {
      time: '2026-08-10T00:00:00',
      head_block_number: 12345,
      virtual_supply: '1000000.000 HIVE',
      network: 'Hive',
    };

    const nextState = reducer(prevState, {
      type: HIVE_GLOBALPROPS_UPDATE_RESOLVED,
      payload,
    });

    expect(nextState).toEqual({
      props: payload,
    });
  });

  it('overwrites a previous props object entirely rather than merging fields', () => {
    const prevState = {
      props: {
        time: '2020-01-01T00:00:00',
        head_block_number: 1,
        stale_field: 'should not survive',
      },
    };

    const payload = {
      time: '2026-08-10T00:00:00',
      head_block_number: 99999,
    };

    const nextState = reducer(prevState, {
      type: HIVE_GLOBALPROPS_UPDATE_RESOLVED,
      payload,
    });

    expect(nextState.props).toEqual(payload);
    expect(nextState.props).not.toHaveProperty('stale_field');
  });

  it('leaves state unchanged for unrelated action types', () => {
    const prevState = {
      props: {
        time: '2026-08-10T00:00:00',
      },
    };

    const nextState = reducer(prevState, { type: 'SOME_OTHER_ACTION' });

    expect(nextState).toBe(prevState);
  });
});
