import { File } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { DATABASE_NAME, closeDatabase, getDatabase } from "@/db/database";
import { DATABASE_VERSION } from "@/db/schema";
import { decryptBackup } from "@/security/cipher";
import { bumpDataEpoch } from "@/state/data-epoch";

const SQLITE_MAGIC = "SQLite format 3\u0000";

const REQUIRED_TABLES = [
  "categories",
  "accounts",
  "transactions",
  "settings",
] as const;

export class RestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestoreError";
  }
  /** Messages are written in French for the user; safe to display as-is. */
  userFacing = true;
}

export interface RestoredBackupInfo {
  transactionCount: number;
  userVersion: number;
}

export interface RestoredBackup {
  plaintext: Uint8Array;
  info: RestoredBackupInfo;
}

function startsWithSqliteMagic(bytes: Uint8Array): boolean {
  if (bytes.length < SQLITE_MAGIC.length) {
    return false;
  }
  for (let i = 0; i < SQLITE_MAGIC.length; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

async function validateDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const userVersion = versionRow?.user_version ?? 0;
  if (userVersion < 1 || userVersion > DATABASE_VERSION) {
    throw new RestoreError(
      `Version de la sauvegarde incompatible (v${userVersion}, app en v${DATABASE_VERSION}).`,
    );
  }
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const names = new Set(tables.map((table) => table.name));
  for (const required of REQUIRED_TABLES) {
    if (!names.has(required)) {
      throw new RestoreError("Ce fichier n'est pas une sauvegarde Wallet valide.");
    }
  }
}

export async function readRestoredBackup(
  uri: string,
  passphrase: string,
): Promise<RestoredBackup> {
  let file: File;
  try {
    file = new File(uri);
  } catch {
    throw new RestoreError("Impossible d'accéder au fichier choisi.");
  }
  if (!file.exists) {
    throw new RestoreError("Le fichier choisi n'existe plus.");
  }
  const bytes = await file.bytes();
  const plaintext = await decryptBackup(bytes, passphrase);
  if (!startsWithSqliteMagic(plaintext)) {
    throw new RestoreError("La sauvegarde décryptée n'est pas valide.");
  }

  const memory = await SQLite.deserializeDatabaseAsync(plaintext);
  try {
    await validateDatabase(memory);
    const countRow = await memory.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM transactions",
    );
    const versionRow = await memory.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    return {
      plaintext,
      info: {
        transactionCount: countRow?.count ?? 0,
        userVersion: versionRow?.user_version ?? 0,
      },
    };
  } finally {
    await memory.closeAsync();
  }
}

export async function applyRestoredBackup(
  plaintext: Uint8Array,
): Promise<void> {
  await closeDatabase();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  const restored = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const memory = await SQLite.deserializeDatabaseAsync(plaintext);
  try {
    await SQLite.backupDatabaseAsync({
      sourceDatabase: memory,
      destDatabase: restored,
    });
  } finally {
    await memory.closeAsync();
    await restored.closeAsync();
  }
  await getDatabase();
  bumpDataEpoch();
}
