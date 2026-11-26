const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** The standard base64 of a string's UTF-8 bytes, padded. Pure: no `Buffer`, no platform global. */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const chunk = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += ALPHABET[(chunk >> 18) & 63];
    out += ALPHABET[(chunk >> 12) & 63];
    out += b1 === undefined ? "=" : ALPHABET[(chunk >> 6) & 63];
    out += b2 === undefined ? "=" : ALPHABET[chunk & 63];
  }
  return out;
}
