import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as SQLite from "expo-sqlite";
import { getDatabase } from "@/db/database";
import { setSetting } from "@/db/settings";
import { DEFAULT_KDF_ITERATIONS } from "@/security/kdf";
import { encryptBackup } from "@/security/cipher";

export const BACKUP_FILE_EXTENSION = "wlbak";
export const PLAIN_BACKUP_FILE_EXTENSION = "wldb";

export interface ExportedBackup {
  name: string;
  uri: string;
  shared: boolean;
  encrypted: boolean;
}

export function shareableFileUri(file: Pick<File, "uri">): string {
  // expo-sharing expects the local file:// URI and creates the Android
  // content:// URI itself before launching the system share sheet.
  return file.uri;
}

function temporaryBackupDatabaseName(): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `wallet-backup-${Date.now()}-${suffix}.db`;
}

export async function serializeDatabaseForBackup(): Promise<Uint8Array> {
  const db = await getDatabase();
  const temporaryName = temporaryBackupDatabaseName();
  const backupDb = await SQLite.openDatabaseAsync(temporaryName, {
    useNewConnection: true,
  });
  try {
    await SQLite.backupDatabaseAsync({
      sourceDatabase: db,
      destDatabase: backupDb,
    });
    await backupDb.runAsync("DELETE FROM app_logs");
    await backupDb.execAsync(`
      CREATE TABLE IF NOT EXISTS backup_attachment_blobs (
        attachment_id INTEGER PRIMARY KEY,
        storage_path  TEXT NOT NULL,
        content       BLOB NOT NULL
      )
    `);
    const attachments = await db.getAllAsync<{
      id: number;
      storagePath: string;
    }>(
      "SELECT id, storage_path AS storagePath FROM transaction_attachments",
    );
    for (const attachment of attachments) {
      try {
        const file = new File(attachment.storagePath);
        if (!file.exists) continue;
        await backupDb.runAsync(
          `INSERT OR REPLACE INTO backup_attachment_blobs
             (attachment_id, storage_path, content)
           VALUES (?, ?, ?)`,
          attachment.id,
          attachment.storagePath,
          await file.bytes(),
        );
      } catch {
        // La base reste exportable; la restauration affichera le fichier manquant.
      }
    }
    return await backupDb.serializeAsync();
  } finally {
    await backupDb.closeAsync().catch(() => {});
    await SQLite.deleteDatabaseAsync(temporaryName).catch(() => {});
  }
}

function dateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}${minute}${second}`;
}

async function writeAndShareBackup(
  bytes: Uint8Array,
  extension: string,
  encrypted: boolean,
): Promise<ExportedBackup> {
  const db = await getDatabase();
  const file = new File(
    Paths.document,
    `wallet-backup-${dateStamp(new Date())}.${extension}`,
  );
  file.create({ overwrite: true, intermediates: true });
  file.write(bytes);
  if (!file.exists || file.size !== bytes.byteLength) {
    throw new Error("Le fichier de sauvegarde n'a pas pu être écrit.");
  }

  let shared = false;
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareableFileUri(file), {
        mimeType: "application/octet-stream",
        dialogTitle: "Sauvegarde Wallet",
      });
      shared = true;
    }
  } catch {
    // Le fichier existe déjà; le partage peut être annulé sans perdre l'export.
  }
  await setSetting(db, "backup_last_date", String(Date.now()));
  return { name: file.name, uri: file.uri, shared, encrypted };
}

export async function exportEncryptedBackup(
  passphrase: string,
): Promise<ExportedBackup> {
  const plaintext = await serializeDatabaseForBackup();
  const encrypted = await encryptBackup(
    plaintext,
    passphrase,
    DEFAULT_KDF_ITERATIONS,
  );
  return writeAndShareBackup(encrypted, BACKUP_FILE_EXTENSION, true);
}

export async function exportPlainBackup(): Promise<ExportedBackup> {
  const plaintext = await serializeDatabaseForBackup();
  return writeAndShareBackup(plaintext, PLAIN_BACKUP_FILE_EXTENSION, false);
}
