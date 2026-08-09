import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import * as os from "node:os";
import * as path from "node:path";
import type { SQLiteDatabase } from "expo-sqlite";
import { migrateDbIfNeeded } from "@/db/schema";

type SqliteBindValue = string | number | bigint | null | Uint8Array;

interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

interface AdapterOptions {
  file?: string | null;
}

export class TestSqliteDatabase {
  private readonly db: DatabaseSync;
  private readonly file: string | null;
  private txDepth = 0;

  constructor(options: AdapterOptions = {}) {
    this.file = options.file ?? null;
    this.db = new DatabaseSync(this.file ?? ":memory:");
    this.db.exec("PRAGMA foreign_keys = ON");
  }

  private bindParams(args: unknown[]): SqliteBindValue[] {
    const params =
      args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    return params.map((value) =>
      value === undefined ? null : (value as SqliteBindValue),
    );
  }

  async runAsync(source: string, ...params: unknown[]): Promise<RunResult> {
    const result = this.db
      .prepare(source)
      .run(...this.bindParams(params));
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
    return this.db
      .prepare(source)
      .all(...this.bindParams(params)) as T[];
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
    const row = this.db.prepare(source).get(...this.bindParams(params));
    return row === undefined ? null : (row as T);
  }

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    if (this.txDepth > 0) {
      await task();
      return;
    }
    this.txDepth += 1;
    this.db.exec("BEGIN");
    try {
      await task();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.txDepth -= 1;
    }
  }

  async serializeAsync(): Promise<Uint8Array> {
    if (!this.file) {
      throw new Error("serializeAsync requires a file-backed test database");
    }
    return new Uint8Array(fs.readFileSync(this.file));
  }

  async closeAsync(): Promise<void> {
    this.db.close();
    if (this.file) {
      try {
        fs.unlinkSync(this.file);
      } catch {
        // already gone
      }
    }
  }
}

export function createTestDbPath(): string {
  return path.join(os.tmpdir(), `wallet-test-${randomUUID()}.db`);
}

export async function createTestDb(
  options: AdapterOptions = {},
): Promise<SQLiteDatabase> {
  const adapter = new TestSqliteDatabase(options);
  await migrateDbIfNeeded(adapter as unknown as SQLiteDatabase);
  return adapter as unknown as SQLiteDatabase;
}
