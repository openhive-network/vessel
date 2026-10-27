import { memoAfterSymbolChange } from '../sendMemo';

describe('memoAfterSymbolChange (Send currency toggle)', () => {
  it('KEEPS a hand-typed memo when there is no preference for the new symbol', () => {
    // The reported fund-loss bug: user types their exchange deposit memo, then toggles HIVE<->HBD.
    expect(memoAfterSymbolChange('deposit-123', false, false)).toEqual({
      memo: 'deposit-123',
      memoDetected: false,
    });
  });

  it('auto-fills from a saved preference for the new symbol', () => {
    expect(memoAfterSymbolChange('deposit-123', false, 'pref-hbd')).toEqual({
      memo: 'pref-hbd',
      memoDetected: 'pref-hbd',
    });
  });

  it('overrides a hand-typed memo when the new symbol has its own preference', () => {
    expect(memoAfterSymbolChange('typed', false, 'pref-hbd')).toEqual({
      memo: 'pref-hbd',
      memoDetected: 'pref-hbd',
    });
  });

  it('clears a previously auto-filled memo when the new symbol has no preference', () => {
    // The old-symbol preference may not apply to the new symbol (some exchanges key memos per coin).
    expect(memoAfterSymbolChange('pref-hive', 'pref-hive', false)).toEqual({
      memo: '',
      memoDetected: false,
    });
  });

  it('swaps one preference for another across symbols', () => {
    expect(memoAfterSymbolChange('pref-hive', 'pref-hive', 'pref-hbd')).toEqual({
      memo: 'pref-hbd',
      memoDetected: 'pref-hbd',
    });
  });

  it('leaves an empty memo empty (no preference, nothing typed)', () => {
    expect(memoAfterSymbolChange('', false, false)).toEqual({ memo: '', memoDetected: false });
  });
});
