import { getDatabaseHealth, getDatabase } from "@/db/database";
import { getSetting } from "@/db/settings";
import { getLockEnabled } from "@/security/store";
import { collectLogs } from "@/utils/log-store";
import { getRecentLogs, log, clearLogs } from "@/utils/logger";
import { runDiagnostics, runStartupHealth } from "./diagnostics";

jest.mock("@/db/database", () => ({
  getDatabase: jest.fn(),
  getDatabaseHealth: jest.fn(),
}));

jest.mock("@/db/settings", () => ({
  getSetting: jest.fn(),
}));

jest.mock("@/security/store", () => ({
  getLockEnabled: jest.fn(),
}));

jest.mock("@/utils/log-store", () => ({
  collectLogs: jest.fn(),
}));

const mockedGetDatabaseHealth = jest.mocked(getDatabaseHealth);
const mockedGetDatabase = jest.mocked(getDatabase);
const mockedGetSetting = jest.mocked(getSetting);
const mockedGetLockEnabled = jest.mocked(getLockEnabled);
const mockedCollectLogs = jest.mocked(collectLogs);

function fakeDb(rows: Record<string, unknown>[] = []) {
  return {
    getFirstAsync: jest.fn(async () => (rows.length > 0 ? rows[0] : null)),
  } as never;
}

describe("runDiagnostics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLogs();
    mockedGetDatabaseHealth.mockResolvedValue({
      open: true,
      integrityOk: true,
      userVersion: 13,
      openMs: 12,
    });
    mockedGetDatabase.mockResolvedValue(fakeDb([{ count: 4 }]));
    mockedGetSetting.mockResolvedValue(Date.now().toString());
    mockedGetLockEnabled.mockResolvedValue(true);
    mockedCollectLogs.mockResolvedValue([]);
  });

  it("rapporte chaque sous-système avec son statut", async () => {
    const report = await runDiagnostics();
    expect(report.items).toHaveLength(4);
    const byId = Object.fromEntries(report.items.map((item) => [item.id, item]));
    expect(byId.db.status).toBe("ok");
    expect(byId["secure-store"].status).toBe("ok");
    expect(byId.currency.status).toBe("ok");
    expect(byId.logs.status).toBe("ok");
    expect(report.sessionId.length).toBeGreaterThan(0);
    expect(typeof report.ranAt).toBe("string");
  });

  it("marque la base comme en échec si elle n'est pas ouverte", async () => {
    mockedGetDatabaseHealth.mockResolvedValue({ open: false } as never);
    const report = await runDiagnostics();
    const db = report.items.find((item) => item.id === "db");
    expect(db?.status).toBe("fail");
  });

  it("marque le journal comme avertissement sans taux en cache", async () => {
    mockedGetDatabase.mockResolvedValue(fakeDb([{ count: 0 }]));
    const report = await runDiagnostics();
    const currency = report.items.find((item) => item.id === "currency");
    expect(currency?.status).toBe("warn");
  });

  it("récupère les logs persistés, sinon le journal mémoire", async () => {
    mockedCollectLogs.mockRejectedValue(new Error("SQLITE error: no such table"));
    log.info("test", "entrée mémoire");
    const report = await runDiagnostics();
    expect(report.logs.length).toBeGreaterThanOrEqual(1);
    expect(report.logs.some((entry) => entry.context === "test")).toBe(true);
  });

  it("continue même si une vérification échoue", async () => {
    mockedGetLockEnabled.mockRejectedValue(new Error("boom"));
    const report = await runDiagnostics();
    expect(report.items).toHaveLength(4);
    const secureStore = report.items.find((item) => item.id === "secure-store");
    expect(secureStore?.status).toBe("fail");
  });
});

describe("runStartupHealth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLogs();
  });

  it("journalise la santé de la base au démarrage", async () => {
    mockedGetDatabaseHealth.mockResolvedValue({
      open: true,
      integrityOk: true,
      userVersion: 13,
      openMs: 5,
    });
    await runStartupHealth();
    const logs = getRecentLogs();
    expect(logs.some((entry) => /SANTÉ AU DÉMARRAGE/.test(entry.message))).toBe(true);
  });

  it("journalise un échec d'ouverture", async () => {
    mockedGetDatabaseHealth.mockRejectedValue(new Error("open failed"));
    await runStartupHealth();
    const logs = getRecentLogs();
    expect(logs.some((entry) => entry.level === "error")).toBe(true);
  });
});
