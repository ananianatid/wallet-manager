import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getDatabase } from "@/db/database";
import { setSetting } from "@/db/settings";
import { DEFAULT_KDF_ITERATIONS } from "@/security/kdf";
import { encryptBackup } from "@/security/cipher";

export const BACKUP_FILE_EXTENSION = "wlbak";

function dateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function exportEncryptedBackup(
  passphrase: string,
): Promise<string> {
  const db = await getDatabase();
  const plaintext = await db.serializeAsync();
  const encrypted = await encryptBackup(
    plaintext,
    passphrase,
    DEFAULT_KDF_ITERATIONS,
  );

  const file = new File(
    Paths.cache,
    `wallet-backup-${dateStamp(new Date())}.${BACKUP_FILE_EXTENSION}`,
  );
  file.create({ overwrite: true, intermediates: true });
  file.write(encrypted);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/octet-stream",
      dialogTitle: "Sauvegarde Wallet",
    });
  }
  await setSetting(db, "backup_last_date", String(Date.now()));
  return file.name;
}
