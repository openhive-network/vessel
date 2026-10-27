// A key store entry as written by vessel before the scrypt/AES-GCM format:
// `CryptoJS.AES.encrypt(wif, 'secret').toString()` (crypto-js passphrase mode,
// OpenSSL "Salted__" with EVP_BytesToKey/MD5), for
// hive.auth.toWif('alice', 'correct horse battery staple', 'active').
export const LEGACY_PASSWORD = 'secret';
export const LEGACY_WIF = '5KMHxYYxqU7wvEETLAaFf4FeprVaTCaicPG2bcBitAKZkiQRoJB';
export const LEGACY_KEY = 'U2FsdGVkX1+hssPU5fYHGEI3M2ZHRUi4BXNiphqlqyP4g46f03c9QD+7jcjDgcrd1aEZdmUDWKXKyLil9Ev+AKkkdJzweRf+jAtr48kbnh0=';
