import { Directory, File, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import type { TransactionAttachment } from "@/types";

const ATTACHMENTS_DIRECTORY_NAME = "transaction-attachments";
const ALLOWED_MIME_TYPES = ["application/pdf"];

function attachmentDirectory(): Directory {
  return new Directory(Paths.document, ATTACHMENTS_DIRECTORY_NAME);
}

function ensureAttachmentDirectory(): Directory {
  const directory = attachmentDirectory();
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function assertSupportedMimeType(mimeType: string): void {
  if (!mimeType.startsWith("image/") && !ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error("Seuls les fichiers image et PDF sont acceptés.");
  }
}

function safeFileName(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return cleaned || "piece-jointe";
}

interface AttachmentRow {
  id: number;
  transactionId: number;
  originalName: string;
  mimeType: string;
  storagePath: string;
  size: number;
  createdAt: number;
}

function mapAttachment(row: AttachmentRow): TransactionAttachment {
  let exists = false;
  try {
    exists = new File(row.storagePath).exists;
  } catch {
    exists = false;
  }
  return { ...row, exists };
}

export async function createTransactionAttachment(
  db: SQLiteDatabase,
  transactionId: number,
  sourceUri: string,
  originalName: string,
  mimeType: string,
): Promise<number> {
  assertSupportedMimeType(mimeType);
  const source = new File(sourceUri);
  if (!source.exists) {
    throw new Error("Le fichier choisi n'existe plus.");
  }
  const directory = ensureAttachmentDirectory();
  const fileName = `${transactionId}-${Date.now()}-${safeFileName(originalName)}`;
  const destination = new File(directory, fileName);
  await source.copy(destination);
  try {
    const result = await db.runAsync(
      `INSERT INTO transaction_attachments
         (transaction_id, original_name, mime_type, storage_path, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      transactionId,
      originalName.trim() || destination.name,
      mimeType,
      destination.uri,
      destination.size,
      Date.now(),
    );
    return Number(result.lastInsertRowId);
  } catch (error) {
    if (destination.exists) {
      destination.delete();
    }
    throw error;
  }
}

export async function listTransactionAttachments(
  db: SQLiteDatabase,
  transactionId: number,
): Promise<TransactionAttachment[]> {
  const rows = await db.getAllAsync<AttachmentRow>(
    `SELECT id,
            transaction_id AS transactionId,
            original_name AS originalName,
            mime_type AS mimeType,
            storage_path AS storagePath,
            size,
            created_at AS createdAt
     FROM transaction_attachments
     WHERE transaction_id = ?
     ORDER BY created_at`,
    transactionId,
  );
  return rows.map(mapAttachment);
}

export async function getTransactionAttachment(
  db: SQLiteDatabase,
  id: number,
): Promise<TransactionAttachment | null> {
  const rows = await db.getAllAsync<AttachmentRow>(
    `SELECT id,
            transaction_id AS transactionId,
            original_name AS originalName,
            mime_type AS mimeType,
            storage_path AS storagePath,
            size,
            created_at AS createdAt
     FROM transaction_attachments
     WHERE id = ?`,
    id,
  );
  return rows[0] ? mapAttachment(rows[0]) : null;
}

export async function deleteTransactionAttachment(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  const attachment = await getTransactionAttachment(db, id);
  if (!attachment) return;
  await db.runAsync("DELETE FROM transaction_attachments WHERE id = ?", id);
  try {
    const file = new File(attachment.storagePath);
    if (file.exists) file.delete();
  } catch {
    // Le fichier manquant est déjà dans l'état attendu après suppression DB.
  }
}

export function attachmentFileFromPath(storagePath: string): File {
  return new File(storagePath);
}

export function privateAttachmentDirectory(): Directory {
  return ensureAttachmentDirectory();
}
