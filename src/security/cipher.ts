import * as Crypto from "expo-crypto";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_HEADER_BYTES,
  BackupFormatError,
  KDF_ID_PBKDF2_SHA256,
  KDF_MAX_ITERATIONS,
  KDF_SALT_BYTES,
  decodeBackupHeader,
  encodeBackupHeader,
  isBackupFile,
} from "./backup-format";
import { deriveBackupKey } from "./kdf";

const MIN_ENCRYPTED_BYTES = BACKUP_HEADER_BYTES + 12 + 16;

export async function encryptBackup(
  plaintext: Uint8Array,
  passphrase: string,
  iterations: number,
): Promise<Uint8Array> {
  if (iterations < 1 || iterations > KDF_MAX_ITERATIONS) {
    throw new BackupFormatError("Paramètres de sauvegarde invalides.");
  }
  const salt = Crypto.getRandomBytes(KDF_SALT_BYTES);
  const key = await deriveBackupKey(passphrase, salt, iterations);
  const aesKey = await Crypto.AESEncryptionKey.import(key);
  const header = encodeBackupHeader({
    formatVersion: BACKUP_FORMAT_VERSION,
    kdfId: KDF_ID_PBKDF2_SHA256,
    iterations,
    salt,
  });
  const sealed = await Crypto.aesEncryptAsync(plaintext, aesKey, {
    additionalData: header,
  });
  const combined = await sealed.combined();
  const output = new Uint8Array(header.length + combined.length);
  output.set(header, 0);
  output.set(combined, header.length);
  return output;
}

export async function decryptBackup(
  bytes: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  if (!isBackupFile(bytes)) {
    throw new BackupFormatError("Ce fichier n'est pas une sauvegarde Wallet.");
  }
  if (bytes.length < MIN_ENCRYPTED_BYTES) {
    throw new BackupFormatError("Fichier de sauvegarde tronqué.");
  }
  const header = decodeBackupHeader(bytes.subarray(0, BACKUP_HEADER_BYTES));
  if (header.kdfId !== KDF_ID_PBKDF2_SHA256) {
    throw new BackupFormatError(
      "Méthode de chiffrement non prise en charge par cette version.",
    );
  }
  const key = await deriveBackupKey(passphrase, header.salt, header.iterations);
  const aesKey = await Crypto.AESEncryptionKey.import(key);
  const sealed = Crypto.AESSealedData.fromCombined(
    bytes.subarray(BACKUP_HEADER_BYTES),
  );
  try {
    return await Crypto.aesDecryptAsync(sealed, aesKey, {
      output: "bytes",
      additionalData: bytes.subarray(0, BACKUP_HEADER_BYTES),
    });
  } catch {
    throw new BackupFormatError("Mot de passe incorrect ou fichier altéré.");
  }
}
