import type { SQLiteDatabase } from "expo-sqlite";
import { getDatabase } from "@/db/database";
import { getSetting, setSetting, type SettingKey } from "@/db/settings";
import { applyDueRecurring } from "@/db/recurring";

export type InitialRoute = "index" | "(tabs)" | "onboarding" | "cloud-welcome";

export interface StartupState {
  needsOnboarding: boolean;
  needsCloudWelcome: boolean;
}

export interface BootstrapDependencies {
  openDatabase: () => Promise<SQLiteDatabase>;
  applyRecurring: (db: SQLiteDatabase) => Promise<unknown>;
  readSetting: (db: SQLiteDatabase, key: SettingKey) => Promise<string | null>;
  writeSetting: (db: SQLiteDatabase, key: SettingKey, value: string) => Promise<void>;
  runHealthCheck: () => Promise<void>;
  scheduleNotifications: (db: SQLiteDatabase) => Promise<void>;
}

export const productionBootstrapDependencies: BootstrapDependencies = {
  openDatabase: getDatabase,
  applyRecurring: async (db) => {
    await applyDueRecurring(db);
  },
  readSetting: getSetting,
  writeSetting: setSetting,
  runHealthCheck: async () => {
    const { runStartupHealth } = await import("@/utils/diagnostics");
    await runStartupHealth();
  },
  scheduleNotifications: async (db) => {
    const { schedulePendingRecurringNotifications } = await import(
      "@/services/recurring-notifications"
    );
    await schedulePendingRecurringNotifications(db);
  },
};

export function initialRouteForStartup(state: StartupState): InitialRoute {
  if (state.needsOnboarding) return "onboarding";
  if (state.needsCloudWelcome) return "cloud-welcome";
  return "(tabs)";
}

export function createApplicationBootstrap(
  dependencies: BootstrapDependencies = productionBootstrapDependencies,
) {
  return async function bootstrapApplication(): Promise<StartupState> {
    const db = await dependencies.openDatabase();
    try {
      await dependencies.applyRecurring(db);
    } catch {
      // Recurring operations are secondary to opening the local application.
    }

    const accountCount = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM accounts WHERE deleted_at IS NULL",
    );
    const completed = await dependencies.readSetting(db, "onboarding_completed");
    const started = await dependencies.readSetting(db, "onboarding_started");
    const cloudWelcomeSeen = await dependencies.readSetting(db, "cloud_welcome_seen");
    const hasAccounts = (accountCount?.count ?? 0) > 0;

    if (hasAccounts && completed !== "1" && started !== "1") {
      await dependencies.writeSetting(db, "onboarding_completed", "1");
    }

    const needsOnboarding = completed !== "1" && (!hasAccounts || started === "1");
    const needsCloudWelcome = cloudWelcomeSeen !== "1" && completed === "1" && !needsOnboarding;

    void dependencies.runHealthCheck().catch(() => {});
    void dependencies.scheduleNotifications(db).catch(() => {});

    return { needsOnboarding, needsCloudWelcome };
  };
}
