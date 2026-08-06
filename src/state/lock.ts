import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import {
  DEFAULT_LOCK_DELAY_SECONDS,
  getLockDelaySeconds,
  getLockDelaySecondsSync,
  getLockEnabled,
  getLockEnabledSync,
} from "@/security/store";

export type LockStatus = "unlocked" | "obscured" | "locked";

interface LockState {
  status: LockStatus;
  enabled: boolean;
  delaySeconds: number;
}

let state: LockState = {
  status: "unlocked",
  enabled: false,
  delaySeconds: DEFAULT_LOCK_DELAY_SECONDS,
};

let initialized = false;
let backgroundedAt = 0;
let lockRequestedBeforeObscure = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): LockState {
  return state;
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setStatus(status: LockStatus): void {
  if (state.status === status) {
    return;
  }
  state = { ...state, status };
  emit();
}

function onAppStateChange(next: string): void {
  if (!state.enabled) {
    return;
  }
  if (next === "background" || next === "inactive") {
    lockRequestedBeforeObscure = state.status === "locked";
    backgroundedAt = Date.now();
    setStatus("obscured");
  } else if (next === "active") {
    if (state.status === "obscured") {
      setStatus(
        lockRequestedBeforeObscure ||
          Date.now() - backgroundedAt >= state.delaySeconds * 1000
          ? "locked"
          : "unlocked",
      );
      lockRequestedBeforeObscure = false;
    }
  }
}

export function initLock(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  AppState.addEventListener("change", onAppStateChange);
  let enabled: boolean;
  try {
    enabled = getLockEnabledSync();
  } catch {
    enabled = false;
  }
  if (enabled) {
    state = {
      status: "locked",
      enabled,
      delaySeconds: getLockDelaySecondsSync(),
    };
    emit();
  }
}

export async function refreshLockConfig(): Promise<void> {
  const [enabled, delaySeconds] = await Promise.all([
    getLockEnabled().catch(() => false),
    getLockDelaySeconds().catch(() => DEFAULT_LOCK_DELAY_SECONDS),
  ]);
  state = {
    enabled,
    delaySeconds,
    status: enabled && state.status !== "unlocked" ? state.status : "unlocked",
  };
  emit();
}

export function lockNow(): void {
  if (state.enabled) {
    setStatus("locked");
  }
}

export function unlock(): void {
  setStatus("unlocked");
}

export function useLockState(): LockState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
