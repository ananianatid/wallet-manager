import { AppState, Platform } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getDatabase } from "@/db/database";
import { getSetting, setSetting } from "@/db/settings";
import { useCloudAuth } from "./auth-context";
import { getSyncProgress, subscribeSyncProgress, type SyncProgress } from "./sync";

type SettingKeyWithSync = Parameters<typeof getSetting>[1] | "cloud_last_sync_at" | "cloud_last_sync_error";

export type SyncStatusKind = "local" | "syncing" | "offline" | "error" | "conflicts" | "synced";

export interface SyncStatus {
  kind: SyncStatusKind;
  isCloudEnabled: boolean;
  isSyncing: boolean;
  pending: number;
  conflicts: number;
  lastSyncedAt: number | null;
  error: string | null;
  progress: SyncProgress;
}

interface SyncStatusContextValue extends SyncStatus {
  refresh: () => Promise<void>;
  markSynced: (cursor: number) => Promise<void>;
  markError: (message: string) => Promise<void>;
  setSyncing: (value: boolean) => void;
}

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

async function readSyncMeta(): Promise<{ pending: number; conflicts: number; lastSyncedAt: number | null; error: string | null }> {
  try {
    const db = await getDatabase();
    let pending = 0;
    try {
      const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM sync_outbox");
      pending = row?.count ?? 0;
    } catch {
      pending = 0;
    }
    let conflicts = 0;
    try {
      const raw = await getSetting(db, "cloud_sync_conflicts" as never);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown[];
        conflicts = Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch {
      conflicts = 0;
    }
    const lastRaw = await getSetting(db, "cloud_last_sync_at" as SettingKeyWithSync as never);
    const lastSyncedAt = lastRaw ? Number(lastRaw) : null;
    const error = await getSetting(db, "cloud_last_sync_error" as SettingKeyWithSync as never);
    return { pending, conflicts, lastSyncedAt: Number.isFinite(lastSyncedAt as number) ? (lastSyncedAt as number) : null, error };
  } catch {
    return { pending: 0, conflicts: 0, lastSyncedAt: null, error: null };
  }
}

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const { status, user } = useCloudAuth();
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>(getSyncProgress());
  const mounted = useRef(true);

  const isCloudEnabled = status === "authenticated" && Boolean(user?.emailVerified) && Platform.OS !== "web";

  const refresh = useCallback(async () => {
    const meta = await readSyncMeta();
    if (!mounted.current) return;
    setPending(meta.pending);
    setConflicts(meta.conflicts);
    setLastSyncedAt(meta.lastSyncedAt);
    setError(meta.error);
  }, []);

  const markSynced = useCallback(async (cursor: number) => {
    try {
      const db = await getDatabase();
      await setSetting(db, "cloud_last_sync_at" as SettingKeyWithSync as never, String(Date.now()));
      await setSetting(db, "cloud_last_sync_error" as SettingKeyWithSync as never, "");
      void cursor;
    } catch {}
    await refresh();
  }, [refresh]);

  const markError = useCallback(async (message: string) => {
    try {
      const db = await getDatabase();
      await setSetting(db, "cloud_last_sync_error" as SettingKeyWithSync as never, message.slice(0, 280));
    } catch {}
    await refresh();
  }, [refresh]);

  const setSyncing = useCallback((value: boolean) => {
    setIsSyncing(value);
    if (value) setError(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  useEffect(() => subscribeSyncProgress((next) => {
    if (!mounted.current) return;
    setProgress(next);
    setIsSyncing(next.active);
    if (next.phase === "error") setError(next.message);
    else if (next.phase === "completed") setError(null);
  }), []);

  useEffect(() => {
    if (!isCloudEnabled) return;
    void refresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    const interval = setInterval(() => void refresh(), 15000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [isCloudEnabled, refresh]);

  // Refresh when app navigates back to foreground tabs – callers can also invoke refresh() after local writes.

  // Also refresh when conflicts or pending likely changed via navigation focus is handled by callers via refresh().

  const kind: SyncStatusKind = useMemo(() => {
    if (!isCloudEnabled) return "local";
    if (isSyncing) return "syncing";
    if (conflicts > 0) return "conflicts";
    if (error) return "error";
    if (pending > 0) return "offline";
    return "synced";
  }, [isCloudEnabled, isSyncing, conflicts, error, pending]);

  const value = useMemo<SyncStatusContextValue>(() => ({
    kind,
    isCloudEnabled,
    isSyncing,
    pending,
    conflicts,
    lastSyncedAt,
    error,
    progress,
    refresh,
    markSynced,
    markError,
    setSyncing,
  }), [kind, isCloudEnabled, isSyncing, pending, conflicts, lastSyncedAt, error, progress, refresh, markSynced, markError, setSyncing]);

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus(): SyncStatusContextValue {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) throw new Error("useSyncStatus doit être utilisé dans SyncStatusProvider.");
  return ctx;
}

export function formatLastSyncedAt(value: number | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  const now = Date.now();
  const diffMs = now - value;
  if (diffMs < 60_000) return "À l'instant";
  if (diffMs < 3_600_000) return `Il y a ${Math.round(diffMs / 60000)} min`;
  if (diffMs < 86_400_000) return `Aujourd'hui ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
