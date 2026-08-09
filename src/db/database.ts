import * as SQLite from "expo-sqlite";
import { migrateDbIfNeeded } from "./schema";
import { attachLogStore, detachLogStore } from "@/utils/log-store";
import { log } from "@/utils/logger";
import { ErrorCodes, errorWithCode } from "@/utils/user-message";

export const DATABASE_NAME = "wallet.db";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }
  return databasePromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const startedAt = Date.now();
  try {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync("PRAGMA journal_mode = WAL;");
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await migrateDbIfNeeded(db);
    log.info("db", "Base de données ouverte", { ms: Date.now() - startedAt });
    attachLogStore(db);
    return db;
  } catch (cause) {
    databasePromise = null;
    log.error("db", "Échec d'ouverture de la base de données", cause);
    throw errorWithCode(
      ErrorCodes.DB_OPEN_FAILED,
      cause instanceof Error ? cause.message : "Impossible d'ouvrir la base de données.",
    );
  }
}

export async function closeDatabase(): Promise<void> {
  if (databasePromise) {
    const db = await databasePromise;
    databasePromise = null;
    detachLogStore();
    await db.closeAsync();
  }
}

export async function resetDatabase(): Promise<void> {
  await closeDatabase();
}

export async function getDatabaseHealth(): Promise<{
  open: boolean;
  userVersion: number;
  integrityOk: boolean;
  openMs: number;
}> {
  const startedAt = Date.now();
  let open = true;
  let userVersion = 0;
  let integrityOk = false;
  try {
    const db = await getDatabase();
    userVersion =
      (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
        ?.user_version ?? 0;
    integrityOk =
      (await db.getFirstAsync<{ integrity_check: string }>("PRAGMA integrity_check"))
        ?.integrity_check === "ok";
  } catch {
    open = false;
  }
  return { open, userVersion, integrityOk, openMs: Date.now() - startedAt };
}
