import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export const PIN_LENGTH = 6;

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_SECONDS = 30;

export function hashPin(pin: string, salt: Uint8Array): string {
  const input = new Uint8Array(salt.length + pin.length);
  input.set(salt, 0);
  for (let i = 0; i < pin.length; i++) {
    input[salt.length + i] = pin.charCodeAt(i);
  }
  return bytesToHex(sha256(input));
}

export function verifyPin(
  pin: string,
  salt: Uint8Array,
  expectedHash: string,
): boolean {
  const actual = hashPin(pin, salt);
  const a = hexToBytes(actual);
  const b = hexToBytes(expectedHash);
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
