import { getDatabase } from "@/db/database";
import { applyImportPlan, readMoneyManagerBackup, type ImportReport } from "@/db/import";
import type { ImportPlan } from "@/db/money-manager";
import { getSetting } from "@/db/settings";

export function loadLastBackupDate(): Promise<string | null> {
  return getDatabase().then((db) => getSetting(db, "backup_last_date"));
}

export function applyLocalMoneyManagerImport(plan: ImportPlan): Promise<ImportReport> {
  return getDatabase().then((db) => applyImportPlan(db, plan));
}

export { readMoneyManagerBackup };
export type { ImportPlan };
export type { ImportReport };
