import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

export const DEFAULT_KDF_ITERATIONS = 100_000;
export const DERIVED_KEY_BYTES = 32;

export async function deriveBackupKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_KDF_ITERATIONS,
): Promise<Uint8Array> {
  return pbkdf2Async(sha256, passphrase, salt, {
    c: iterations,
    dkLen: DERIVED_KEY_BYTES,
  });
}
