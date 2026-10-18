const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const TOKEN_LENGTH = 22; // ~131 bits d'entropia

export type RandomBytes = (n: number) => Uint8Array;

export const cryptoRandomBytes: RandomBytes = (n) => {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return buf;
};

/**
 * Token base62 sense biaix (rebutja bytes >= 248 perquè 248 = 62 * 4).
 */
export function generateToken(randomBytes: RandomBytes = cryptoRandomBytes, length = TOKEN_LENGTH): string {
  let out = '';
  while (out.length < length) {
    const bytes = randomBytes(length * 2);
    for (const b of bytes) {
      if (b >= 248) continue;
      out += ALPHABET[b % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

export function isValidToken(value: string): boolean {
  return value.length === TOKEN_LENGTH && /^[0-9A-Za-z]+$/.test(value);
}
