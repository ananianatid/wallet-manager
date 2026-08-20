import Constants from "expo-constants";
import { getDatabase, getDatabaseHealth } from "@/db/database";
import { getSetting } from "@/db/settings";
import { getLockEnabled } from "@/security/store";
import { collectLogs } from "@/utils/log-store";
import { getSessionId, getRecentLogs, log, type LogEntry } from "@/utils/logger";
import { getPerformanceSummary, type PerformanceSummary } from "@/services/performance";

export type DiagnosticStatus = "ok" | "warn" | "fail";

export interface DiagnosticItem {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
  ms: number;
}

export interface DiagnosticReport {
  ranAt: string;
  appVersion: string;
  sessionId: string;
  items: DiagnosticItem[];
  performance: PerformanceSummary[];
  logs: LogEntry[];
}

function item(
  id: string,
  label: string,
  status: DiagnosticStatus,
  detail: string,
  ms: number,
): DiagnosticItem {
  return { id, label, status, detail, ms };
}

async function runCheck(
  id: string,
  label: string,
  check: () => Promise<Omit<DiagnosticItem, "id" | "label" | "ms">>,
): Promise<DiagnosticItem> {
  const startedAt = Date.now();
  try {
    const result = await check();
    return item(id, label, result.status, result.detail, Date.now() - startedAt);
  } catch (cause) {
    log.error(`diagnostics.${id}`, `Vérification de ${label.toLowerCase()} impossible`, cause);
    return item(id, label, "fail", "Vérification impossible.", Date.now() - startedAt);
  }
}

async function checkDatabase(): Promise<DiagnosticItem> {
  return runCheck("db", "Base de données", async () => {
    const health = await getDatabaseHealth();
    if (!health.open) {
      return { status: "fail", detail: "Impossible d'ouvrir la base de données." };
    }
    if (!health.integrityOk) {
      return { status: "fail", detail: "Intégrité de la base compromise." };
    }
    return { status: "ok", detail: `Version du schéma ${health.userVersion} · intégrité vérifiée` };
  });
}

async function checkSecureStore(): Promise<DiagnosticItem> {
  return runCheck("secure-store", "Stockage sécurisé", async () => {
    const enabled = await getLockEnabled();
    return { status: "ok", detail: enabled ? "Verrouillage activé" : "Verrouillage désactivé" };
  });
}

async function checkCurrencyCache(): Promise<DiagnosticItem> {
  return runCheck("currency", "Taux de change", async () => {
    const db = await getDatabase();
    const lastRefresh = Number(await getSetting(db, "currency_last_refresh"));
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM fx_rates",
    );
    const count = row?.count ?? 0;
    if (count === 0) {
      return { status: "warn", detail: "Aucun taux en cache (téléchargement nécessaire)" };
    }
    const ageHours = lastRefresh > 0 ? (Date.now() - lastRefresh) / 3_600_000 : Infinity;
    if (ageHours > 12) {
      return {
        status: "warn",
        detail: `${count} taux en cache · dernière actualisation il y a ${Math.round(ageHours)} h`,
      };
    }
    return { status: "ok", detail: `${count} taux en cache` };
  });
}

async function checkLogStore(): Promise<DiagnosticItem> {
  return runCheck("logs", "Journal", async () => {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM app_logs",
    );
    return { status: "ok", detail: `${row?.count ?? 0} entrées persistées` };
  });
}

export async function runDiagnostics(): Promise<DiagnosticReport> {
  const items = await Promise.all([
    checkDatabase(),
    checkSecureStore(),
    checkCurrencyCache(),
    checkLogStore(),
  ]);
  let logs: LogEntry[] = getRecentLogs(50);
  try {
    logs = await collectLogs(await getDatabase(), 50);
  } catch (cause) {
    log.warn("diagnostics", "Journal persistant indisponible, journal mémoire utilisé", cause);
  }
  return {
    ranAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? "1.0.0",
    sessionId: getSessionId(),
    items,
    performance: getPerformanceSummary(),
    logs,
  };
}

export async function runStartupHealth(): Promise<void> {
  try {
    const health = await getDatabaseHealth();
    if (!health.open) {
      log.error("app", "SANTÉ AU DÉMARRAGE : base de données inaccessible");
      return;
    }
    log.info("app", "SANTÉ AU DÉMARRAGE : base de données OK", {
      userVersion: health.userVersion,
      integrityOk: health.integrityOk,
      openMs: health.openMs,
    });
  } catch (cause) {
    log.error("app", "SANTÉ AU DÉMARRAGE : vérification impossible", cause);
  }
}
