/**
 * Money-path helper for the Send form's memo field.
 *
 * PARAMOUNT: on an exchange transfer the memo is the deposit-routing tag — losing it credits the
 * deposit to nobody and the funds are gone. So a currency toggle (HIVE <-> HBD) must never silently
 * discard a memo the user typed by hand: the same exchange + deposit account routes on the same memo
 * regardless of coin.
 *
 * Rules when the currency changes:
 *  - a saved preference exists for the NEW symbol  -> use it (auto-fill, flagged as detected)
 *  - no preference, but the current memo was itself auto-filled from a preference for the OLD symbol
 *    -> clear it (that preference may not apply to the new symbol; some exchanges key memos per coin)
 *  - no preference and the memo was hand-typed      -> KEEP it (never drop the user's own input)
 */
export interface MemoState {
  memo: string;
  memoDetected: string | false;
}

export function memoAfterSymbolChange(
  currentMemo: string,
  wasDetected: string | false,
  detectedForNewSymbol: string | false
): MemoState {
  if (detectedForNewSymbol) {
    return { memo: detectedForNewSymbol, memoDetected: detectedForNewSymbol };
  }
  if (wasDetected) {
    return { memo: '', memoDetected: false };
  }
  return { memo: currentMemo, memoDetected: false };
}
