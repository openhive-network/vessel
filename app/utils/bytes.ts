/**
 * Small byte helpers for the key envelope. `btoa`/`atob`/`TextEncoder`/`TextDecoder` are global in
 * Node >= 16 and every renderer. Pure — no legacy imports. `b64decode` throws on invalid base64;
 * callers map that to `InvalidCiphertextError`.
 */

export const utf8encode = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Strict decode: invalid UTF-8 throws (callers map to WrongPasswordError). */
export const utf8decode = (u8: Uint8Array): string =>
  new TextDecoder('utf-8', { fatal: true }).decode(u8);

export const b64encode = (u8: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < u8.length; i += 1) s += String.fromCharCode(u8[i]);
  return btoa(s);
};

export const b64decode = (s: string): Uint8Array => {
  const bin = atob(s); // throws on invalid base64
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return u8;
};

export const concat = (...arrs: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let off = 0;
  arrs.forEach((a) => {
    out.set(a, off);
    off += a.length;
  });
  return out;
};
