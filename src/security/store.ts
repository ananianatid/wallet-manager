import * as SecureStore from "expo-secure-store";
import { bytesToHex } from "@noble/hashes/utils.js";

export const LOCK_DELAY_OPTIONS_SECONDS = [30, 60, 300, 900] as const;
export const DEFAULT_LOCK_DELAY_SECONDS = 60;

const KEY_ENABLED = "lock.enabled";
const KEY_DELAY_SECONDS = "lock.delaySeconds";
const KEY_PIN_SALT = "lock.pinSalt";
const KEY_PIN_HASH = "lock.pinHash";
const KEY_FAILED_ATTEMPTS = "lock.failedAttempts";
const KEY_LOCKOUT_UNTIL = "lock.lockoutUntil";

function parseEnabled(value: string | null): boolean {
  return value === "1";
}

function parseDelaySeconds(value: string | null): number {
  const parsed = value == null ? NaN : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LOCK_DELAY_SECONDS;
}

export async function getLockEnabled(): Promise<boolean> {
  return parseEnabled(await SecureStore.getItemAsync(KEY_ENABLED));
}

export function getLockEnabledSync(): boolean {
  return parseEnabled(SecureStore.getItem(KEY_ENABLED));
}

export async function setLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY_ENABLED, enabled ? "1" : "0");
}

export async function getLockDelaySeconds(): Promise<number> {
  return parseDelaySeconds(await SecureStore.getItemAsync(KEY_DELAY_SECONDS));
}

export function getLockDelaySecondsSync(): number {
  return parseDelaySeconds(SecureStore.getItem(KEY_DELAY_SECONDS));
}

export async function setLockDelaySeconds(seconds: number): Promise<void> {
  await SecureStore.setItemAsync(KEY_DELAY_SECONDS, String(seconds));
}

export async function getPinSalt(): Promise<Uint8Array | null> {
  const hex = await SecureStore.getItemAsync(KEY_PIN_SALT);
  if (!hex) {
    return null;
  }
  return Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
    parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  );
}

export async function setPinCredentials(
  salt: Uint8Array,
  pinHash: string,
): Promise<void> {
  await SecureStore.setItemAsync(KEY_PIN_SALT, bytesToHex(salt));
  await SecureStore.setItemAsync(KEY_PIN_HASH, pinHash);
}

export async function getPinHash(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_PIN_HASH);
}

export async function clearPinCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PIN_SALT);
  await SecureStore.deleteItemAsync(KEY_PIN_HASH);
  await SecureStore.deleteItemAsync(KEY_FAILED_ATTEMPTS);
  await SecureStore.deleteItemAsync(KEY_LOCKOUT_UNTIL);
}

export async function getFailedPinAttempts(): Promise<number> {
  const value = await SecureStore.getItemAsync(KEY_FAILED_ATTEMPTS);
  const parsed = value == null ? NaN : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function setFailedPinAttempts(attempts: number): Promise<void> {
  await SecureStore.setItemAsync(KEY_FAILED_ATTEMPTS, String(attempts));
}

export async function getPinLockoutUntil(): Promise<number | null> {
  const value = await SecureStore.getItemAsync(KEY_LOCKOUT_UNTIL);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function setPinLockoutUntil(until: number | null): Promise<void> {
  if (until == null) {
    await SecureStore.deleteItemAsync(KEY_LOCKOUT_UNTIL);
  } else {
    await SecureStore.setItemAsync(KEY_LOCKOUT_UNTIL, String(until));
  }
}
