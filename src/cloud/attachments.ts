import { File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";
import { markAttachmentCloudUploaded } from "@/db/attachments";
import { uploadCloudAttachment } from "./api";

export async function uploadPendingCloudAttachments(db: SQLiteDatabase): Promise<number> {
  const rows = await db.getAllAsync<{
    id: number;
    transactionSyncId: string;
    storagePath: string;
    originalName: string;
    mimeType: string;
  }>(
    `SELECT a.id,
            t.sync_id AS transactionSyncId,
            a.storage_path AS storagePath,
            a.original_name AS originalName,
            a.mime_type AS mimeType
     FROM transaction_attachments a
     JOIN transactions t ON t.id = a.transaction_id
     WHERE a.cloud_url IS NULL
     ORDER BY a.created_at
     LIMIT 20`,
  );
  let uploaded = 0;
  for (const row of rows) {
    try {
      const file = new File(row.storagePath);
      if (!file.exists) continue;
      const result = await uploadCloudAttachment({
        entityType: "transactions",
        entityId: row.transactionSyncId,
        uri: row.storagePath,
        originalName: row.originalName,
        mimeType: row.mimeType,
      });
      await markAttachmentCloudUploaded(db, row.id, result.id, result.url);
      uploaded++;
    } catch {
      // La pièce jointe reste locale et sera retentée à la prochaine sync.
    }
  }
  return uploaded;
}
