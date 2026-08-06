import * as SQLite from "expo-sqlite";
import { migrateDbIfNeeded } from "./schema";

export const DATABASE_NAME = "wallet.db";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }
  return databasePromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await migrateDbIfNeeded(db);
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (databasePromise) {
    const db = await databasePromise;
    databasePromise = null;
    await db.closeAsync();
  }
}

export async function resetDatabase(): Promise<void> {
  await closeDatabase();
}
