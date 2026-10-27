import { describe, it, expect } from 'vitest';
import {
  parseAndValidateSignOps,
  MAX_SIGN_OPS,
  MAX_SIGN_PAYLOAD_B64_LEN,
} from '../signPayload';

/** Phase 3 · Task 5 — untrusted `vessel://sign` ops payload validation. */
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');

const XFER: [string, Record<string, any>] = [
  'transfer',
  { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: '' },
];

describe('parseAndValidateSignOps', () => {
  it('accepts a well-formed single operation', () => {
    const r = parseAndValidateSignOps(b64([XFER]));
    expect(r.ok).toBe(true);
    expect(r.ops).toEqual([XFER]);
    expect(r.error).toBeUndefined();
  });

  it('accepts multiple operations', () => {
    const r = parseAndValidateSignOps(b64([XFER, ['vote', { voter: 'a', author: 'b', permlink: 'p', weight: 1 }]]));
    expect(r.ok).toBe(true);
    expect(r.ops).toHaveLength(2);
  });

  it('accepts an UNKNOWN op type with a valid shape (Vessel is a general signer — no name allowlist)', () => {
    const r = parseAndValidateSignOps(b64([['some_future_op', { whatever: true }]]));
    expect(r.ok).toBe(true);
    expect(r.ops[0][0]).toBe('some_future_op');
  });

  it('rejects a non-string / empty input', () => {
    expect(parseAndValidateSignOps(undefined).ok).toBe(false);
    expect(parseAndValidateSignOps('').ok).toBe(false);
    expect(parseAndValidateSignOps(123 as any).ok).toBe(false);
  });

  it('rejects an oversized payload before parsing', () => {
    const huge = 'A'.repeat(MAX_SIGN_PAYLOAD_B64_LEN + 1);
    const r = parseAndValidateSignOps(huge);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/too large/i);
  });

  it('rejects payload that is not valid JSON', () => {
    const r = parseAndValidateSignOps(Buffer.from('not json at all').toString('base64'));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid json/i);
  });

  it('rejects a JSON object (not an operations array)', () => {
    const r = parseAndValidateSignOps(b64({ not: 'an array' }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/list of operations/i);
  });

  it('rejects an empty operations array', () => {
    const r = parseAndValidateSignOps(b64([]));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no operations/i);
  });

  it('rejects too many operations', () => {
    const many = Array.from({ length: MAX_SIGN_OPS + 1 }, () => XFER);
    const r = parseAndValidateSignOps(b64(many));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/too many/i);
  });

  it('accepts exactly the max operation count', () => {
    const many = Array.from({ length: MAX_SIGN_OPS }, () => XFER);
    expect(parseAndValidateSignOps(b64(many)).ok).toBe(true);
  });

  it('rejects malformed operation tuples', () => {
    expect(parseAndValidateSignOps(b64(['transfer'])).ok).toBe(false); // op not a tuple
    expect(parseAndValidateSignOps(b64([['transfer']])).ok).toBe(false); // 1-element
    expect(parseAndValidateSignOps(b64([['transfer', {}, 'extra']])).ok).toBe(false); // 3-element
    expect(parseAndValidateSignOps(b64([[123, {}]])).ok).toBe(false); // non-string name
    expect(parseAndValidateSignOps(b64([['', {}]])).ok).toBe(false); // empty name
    expect(parseAndValidateSignOps(b64([['transfer', null]])).ok).toBe(false); // null params
    expect(parseAndValidateSignOps(b64([['transfer', [1, 2]]])).ok).toBe(false); // array params
    expect(parseAndValidateSignOps(b64([['transfer', 'nope']])).ok).toBe(false); // non-object params
  });

  it('pinpoints which operation is malformed', () => {
    const r = parseAndValidateSignOps(b64([XFER, ['bad']]));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/operation 2/i);
  });
});
