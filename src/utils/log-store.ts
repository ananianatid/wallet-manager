import type { SQLiteDatabase } from "expo-sqlite";
import { addLogSink, getRecentLogs, logLevelAtLeast, type LogEntry } from "./logger";

const MAX_ROWS = 500;

let database: SQLiteDatabase | null = null;
let broken = false;

export function attachLogStore(db: SQLiteDatabase): void {
  database = db;
  broken = false;
}

export function detachLogStore(): void {
  database = null;
}

addLogSink((entry) => {
  const db = database;
  if (!db || broken || !logLevelAtLeast(entry, "warn")) {
    return;
  }
  void insertLogEntry(db, entry).catch(() => {
    // Persisting logs must never break the app; stop retrying after a failure.
    broken = true;
  });
});

async function insertLogEntry(db: SQLiteDatabase, entry: LogEntry): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_logs (ts, level, context, message, session_id, error, data)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    entry.ts,
    entry.level,
    entry.context,
    entry.message,
    entry.sessionId,
    entry.error ? JSON.stringify(entry.error) : null,
    entry.data ? JSON.stringify(entry.data) : null,
  );
  await db.runAsync(
    `DELETE FROM app_logs
     WHERE id NOT IN (SELECT id FROM app_logs ORDER BY id DESC LIMIT ?)`,
    MAX_ROWS,
  );
}

export interface StoredLogRow {
  id: number;
  ts: string;
  level: string;
  context: string;
  message: string;
  session_id: string;
  error: string | null;
  data: string | null;
}

export async function readPersistedLogs(
  db: SQLiteDatabase,
  limit = 50,
): Promise<LogEntry[]> {
  const rows = await db.getAllAsync<StoredLogRow>(
    "SELECT id, ts, level, context, message, session_id, error, data FROM app_logs ORDER BY id DESC LIMIT ?",
    limit,
  );
  return rows.reverse().map((row) => ({
    ts: row.ts,
    level: row.level as LogEntry["level"],
    context: row.context,
    message: row.message,
    sessionId: row.session_id,
    ...(row.error ? { error: JSON.parse(row.error) as LogEntry["error"] } : {}),
    ...(row.data ? { data: JSON.parse(row.data) as Record<string, unknown> } : {}),
  }));
}

export async function collectLogs(db: SQLiteDatabase, limit = 50): Promise<LogEntry[]> {
  const recent = getRecentLogs(limit);
  try {
    const persisted = await readPersistedLogs(db, limit);
    const merged = new Map<string, LogEntry>();
    for (const entry of [...persisted, ...recent]) {
      merged.set(`${entry.ts}-${entry.message}`, entry);
    }
    return [...merged.values()].slice(-limit);
  } catch {
    return recent;
  }
}
