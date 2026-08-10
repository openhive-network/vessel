import { describe, it, expect } from 'vitest';
import { parseSignRequest } from '../signUri';

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64');

describe('parseSignRequest — hive://sign deep-link (money-path)', () => {
  it('extracts ops + meta from hive://sign/tx/<ops>#<meta>', () => {
    const ops = b64([['transfer', { from: 'a', to: 'b', amount: '1.000 HIVE', memo: '' }]]);
    const meta = b64({ foo: 1 });
    expect(parseSignRequest(`hive://sign/tx/${ops}#${meta}`)).toEqual({ ops, meta });
  });

  it('accepts the vessel:// scheme identically', () => {
    const ops = b64([['vote', {}]]);
    expect(parseSignRequest(`vessel://sign/tx/${ops}`)).toEqual({ ops, meta: 'e30=' });
  });

  it('matches the sign host case-insensitively (url-parse lowercased the authority; URL does not)', () => {
    const ops = b64([['transfer', { from: 'a', to: 'b', amount: '1.000 HIVE', memo: '' }]]);
    expect(parseSignRequest(`hive://SIGN/tx/${ops}`)).toEqual({ ops, meta: 'e30=' });
    expect(parseSignRequest(`vessel://Sign/tx/${ops}`)).toEqual({ ops, meta: 'e30=' });
  });

  it("defaults meta to base64('{}') when the fragment is absent", () => {
    const ops = b64(['x']);
    expect(parseSignRequest(`hive://sign/tx/${ops}`)?.meta).toBe('e30=');
  });

  it('preserves base64 containing + and / byte-for-byte (the url-parse->URL hazard)', () => {
    // '+/+/+/+/' and '+/+/' are valid base64 (Buffer.from([0xfb,0xff,0xbf]) === '+/+/')
    expect(parseSignRequest('hive://sign/tx/+/+/+/+/#+/+/')).toEqual({ ops: '+/+/+/+/', meta: '+/+/' });
  });

  it('returns null for a non-sign host', () => {
    expect(parseSignRequest('hive://transfer/tx/YWJj')).toBeNull();
  });

  it('returns null for a malformed / non-URL string', () => {
    expect(parseSignRequest('not a url')).toBeNull();
    expect(parseSignRequest('')).toBeNull();
  });

  it('returns null when there is no /tx/ segment', () => {
    expect(parseSignRequest('hive://sign/')).toBeNull();
  });
});
