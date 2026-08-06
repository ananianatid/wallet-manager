import { useSyncExternalStore } from "react";

let epoch = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): number {
  return epoch;
}

export function useDataEpoch(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function bumpDataEpoch(): void {
  epoch++;
  listeners.forEach((listener) => listener());
}
