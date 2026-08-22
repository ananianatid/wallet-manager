import { AppState } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  loginCloudAccount,
  logoutCloudAccount,
  registerCloudAccount,
  refreshCloudUser,
  resendVerificationEmail,
  restoreCloudSession,
  type CloudUser,
} from "./api";
import { getDatabase } from "@/db/database";
import { getSetting, setSetting } from "@/db/settings";
import { runSync, type SyncRunResult } from "./sync";

type AuthStatus = "loading" | "guest" | "authenticated";

interface CloudAuthContextValue {
  status: AuthStatus;
  user: CloudUser | null;
  signIn: (email: string, password: string) => Promise<CloudUser>;
  signUp: (email: string, password: string) => Promise<CloudUser>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  resendVerification: () => Promise<void>;
  syncNow: () => Promise<SyncRunResult>;
}

const CloudAuthContext = createContext<CloudAuthContextValue | null>(null);

export function CloudAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CloudUser | null>(null);
  const syncInFlight = useRef(false);

  const syncIfAllowed = useCallback(async (candidate: CloudUser | null) => {
    if (!candidate?.emailVerified || syncInFlight.current) return;
    const db = await getDatabase();
    if ((await getSetting(db, "cloud_sync_initialized")) !== "1") return;
    syncInFlight.current = true;
    try {
      const result = await runSync(db);
      await setSetting(db, "cloud_last_sync_at" as never, String(Date.now()));
      await setSetting(db, "cloud_last_sync_error" as never, "");
      void result;
    } catch (e) {
      try {
        await setSetting(await getDatabase(), "cloud_last_sync_error" as never, e instanceof Error ? e.message.slice(0, 280) : "Échec de synchronisation.");
      } catch {}
    } finally {
      syncInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    void restoreCloudSession()
      .then((restored) => {
        if (!active) return;
        setUser(restored);
        setStatus(restored ? "authenticated" : "guest");
      })
      .catch(() => {
        if (active) setStatus("guest");
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await loginCloudAccount({ email, password, deviceName: "Wallet Manager" });
    await setSetting(await getDatabase(), "cloud_welcome_seen", "1");
    setUser(next);
    setStatus("authenticated");
    void syncIfAllowed(next);
    return next;
  }, [syncIfAllowed]);

  const signUp = useCallback(async (email: string, password: string) => {
    const next = await registerCloudAccount({ email, password, deviceName: "Wallet Manager" });
    await setSetting(await getDatabase(), "cloud_welcome_seen", "1");
    setUser(next);
    setStatus("authenticated");
    void syncIfAllowed(next);
    return next;
  }, [syncIfAllowed]);

  const signOut = useCallback(async () => {
    await logoutCloudAccount();
    setUser(null);
    setStatus("guest");
  }, []);

  const refreshUser = useCallback(async () => {
    const next = await refreshCloudUser();
    setUser(next);
    setStatus("authenticated");
  }, []);

  const resendVerification = useCallback(async () => {
    await resendVerificationEmail();
  }, []);

  const syncNow = useCallback(async () => {
    if (!user?.emailVerified) throw new Error("Vérifiez votre adresse email avant de synchroniser.");
    if (syncInFlight.current) {
      const cursor = Number((await getSetting(await getDatabase(), "cloud_sync_cursor")) ?? "0");
      return { pushed: 0, pulled: 0, conflicts: [], cursor };
    }
    syncInFlight.current = true;
    try {
      const db = await getDatabase();
      const result = await runSync(db);
      if (result.conflicts.length === 0) await setSetting(db, "cloud_sync_initialized", "1");
      try {
        await setSetting(db, "cloud_last_sync_at" as never, String(Date.now()));
        await setSetting(db, "cloud_last_sync_error" as never, "");
      } catch {}
      return result;
    } catch (e) {
      try {
        await setSetting(await getDatabase(), "cloud_last_sync_error" as never, e instanceof Error ? e.message.slice(0, 280) : "Échec de synchronisation.");
      } catch {}
      throw e;
    } finally {
      syncInFlight.current = false;
    }
  }, [user]);

  useEffect(() => {
    void syncIfAllowed(user);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void syncIfAllowed(user);
    });
    const interval = user?.emailVerified
      ? setInterval(() => void syncIfAllowed(user), 15_000)
      : null;
    return () => {
      subscription.remove();
      if (interval) clearInterval(interval);
    };
  }, [syncIfAllowed, user]);

  const value = useMemo(() => ({ status, user, signIn, signUp, signOut, refreshUser, resendVerification, syncNow }), [status, user, signIn, signUp, signOut, refreshUser, resendVerification, syncNow]);
  return <CloudAuthContext.Provider value={value}>{children}</CloudAuthContext.Provider>;
}

export function useCloudAuth(): CloudAuthContextValue {
  const context = useContext(CloudAuthContext);
  if (!context) throw new Error("useCloudAuth doit être utilisé dans CloudAuthProvider.");
  return context;
}
