import type { SQLiteDatabase } from "expo-sqlite";

export type SettingKey =
  | "theme_mode"
  | "accent_theme"
  | "recurring_last_check"
  | "backup_last_date"
  | "savings_subtract_from_available";

export async function getSetting(
  db: SQLiteDatabase,
  key: SettingKey,
): Promise<string | null> {
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  );
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: SettingKey,
  value: string,
): Promise<void> {
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  );
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}
