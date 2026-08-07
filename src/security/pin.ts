import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export const PIN_LENGTH = 6;

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_SECONDS = 30;

export const PIN_PBKDF2_ITERATIONS = 10_000;

const PBKDF2_PREFIX = `${PIN_PBKDF2_ITERATIONS}:`;

function safeEqualHex(a: string, b: string): boolean {
  const aa = hexToBytes(a);
  const bb = hexToBytes(b);
  if (aa.length !== bb.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aa.length; i++) {
    diff |= aa[i] ^ bb[i];
  }
  return diff === 0;
}

function legacySha256Hash(pin: string, salt: Uint8Array): string {
  const input = new Uint8Array(salt.length + pin.length);
  input.set(salt, 0);
  for (let i = 0; i < pin.length; i++) {
    input[salt.length + i] = pin.charCodeAt(i);
  }
  return bytesToHex(sha256(input));
}

export async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const derived = await pbkdf2Async(sha256, pin, salt, {
    c: PIN_PBKDF2_ITERATIONS,
    dkLen: 32,
  });
  return PBKDF2_PREFIX + bytesToHex(derived);
}

export async function verifyPin(
  pin: string,
  salt: Uint8Array,
  expectedHash: string,
): Promise<boolean> {
  if (expectedHash.startsWith(PBKDF2_PREFIX)) {
    const expected = expectedHash.slice(PBKDF2_PREFIX.length);
    const actual = (await hashPin(pin, salt)).slice(PBKDF2_PREFIX.length);
    return safeEqualHex(actual, expected);
  }
  return safeEqualHex(legacySha256Hash(pin, salt), expectedHash);
}
