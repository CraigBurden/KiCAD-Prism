/**
 * Object ids (CONTRACTS §1): `<prefix>_<10 random base32>`. The caller always
 * chooses the id, so one request can add an object and refer to it.
 */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export type IdPrefix = "occ" | "sub" | "mate" | "har" | "end" | "link" | "wire" | "sheet" | "wvr" | "bc";

export function newId(prefix: IdPrefix, random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
  const bytes = random(new Uint8Array(10));
  let tail = "";
  for (const byte of bytes) tail += ALPHABET[byte & 31];
  return `${prefix}_${tail}`;
}
