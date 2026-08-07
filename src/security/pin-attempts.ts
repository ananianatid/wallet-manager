import { PIN_LOCKOUT_SECONDS, PIN_MAX_ATTEMPTS, verifyPin } from "./pin";
import {
  getFailedPinAttempts,
  getPinHash,
  getPinSalt,
  getPinLockoutUntil,
  setFailedPinAttempts,
  setPinLockoutUntil,
} from "./store";

export interface PinAttemptState {
  lockedOut: boolean;
  remainingMs: number;
  attempts: number;
  remainingAttempts: number;
}

export async function checkPinAttemptState(
  now: number = Date.now(),
): Promise<PinAttemptState> {
  const lockoutUntil = await getPinLockoutUntil();
  if (lockoutUntil != null && lockoutUntil > now) {
    return {
      lockedOut: true,
      remainingMs: lockoutUntil - now,
      attempts: 0,
      remainingAttempts: 0,
    };
  }
  const attempts = await getFailedPinAttempts();
  return {
    lockedOut: false,
    remainingMs: 0,
    attempts,
    remainingAttempts: Math.max(0, PIN_MAX_ATTEMPTS - attempts),
  };
}

export async function recordPinFailure(
  now: number = Date.now(),
): Promise<PinAttemptState> {
  const current = await checkPinAttemptState(now);
  if (current.lockedOut) {
    return current;
  }
  const nextAttempts = current.attempts + 1;
  if (nextAttempts >= PIN_MAX_ATTEMPTS) {
    await setPinLockoutUntil(now + PIN_LOCKOUT_SECONDS * 1000);
    await setFailedPinAttempts(0);
    return {
      lockedOut: true,
      remainingMs: PIN_LOCKOUT_SECONDS * 1000,
      attempts: 0,
      remainingAttempts: 0,
    };
  }
  await setFailedPinAttempts(nextAttempts);
  return {
    lockedOut: false,
    remainingMs: 0,
    attempts: nextAttempts,
    remainingAttempts: PIN_MAX_ATTEMPTS - nextAttempts,
  };
}

export async function clearPinAttempts(): Promise<void> {
  await setFailedPinAttempts(0);
  await setPinLockoutUntil(null);
}

export async function verifyPinGuarded(
  candidate: string,
  now: number = Date.now(),
): Promise<{ ok: boolean; state: PinAttemptState }> {
  const current = await checkPinAttemptState(now);
  if (current.lockedOut) {
    return { ok: false, state: current };
  }
  const [salt, expectedHash] = await Promise.all([
    getPinSalt().catch(() => null),
    getPinHash().catch(() => null),
  ]);
  if (salt && expectedHash && (await verifyPin(candidate, salt, expectedHash))) {
    await clearPinAttempts();
    return {
      ok: true,
      state: { lockedOut: false, remainingMs: 0, attempts: 0, remainingAttempts: PIN_MAX_ATTEMPTS },
    };
  }
  const state = await recordPinFailure(now);
  return { ok: false, state };
}
