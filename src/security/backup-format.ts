export const BACKUP_MAGIC = "WLTBKUP1";
export const BACKUP_FORMAT_VERSION = 1;
export const KDF_ID_PBKDF2_SHA256 = 1;
export const KDF_SALT_BYTES = 16;
export const KDF_MAX_ITERATIONS = 2_000_000;
export const GCM_IV_BYTES = 12;
export const GCM_TAG_BYTES = 16;
export const SQLITE_MAGIC = "SQLite format 3\u0000";
export const BACKUP_HEADER_BYTES =
  BACKUP_MAGIC.length + 4 + 2 + 4 + KDF_SALT_BYTES;

export type BackupStorageFormat = "encrypted" | "plain";

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupFormatError";
  }
  /** Messages are written in French for the user; safe to display as-is. */
  userFacing = true;
}

export interface BackupHeader {
  formatVersion: number;
  kdfId: number;
  iterations: number;
  salt: Uint8Array;
}

function writeU16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value);
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value);
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(view.getUint8(offset + i));
  }
  return out;
}

export function encodeBackupHeader(header: BackupHeader): Uint8Array {
  if (header.salt.length !== KDF_SALT_BYTES) {
    throw new BackupFormatError("Longueur de sel invalide.");
  }
  const bytes = new Uint8Array(BACKUP_HEADER_BYTES);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, BACKUP_MAGIC);
  writeU32(view, BACKUP_MAGIC.length, header.formatVersion);
  writeU16(view, BACKUP_MAGIC.length + 4, header.kdfId);
  writeU32(view, BACKUP_MAGIC.length + 6, header.iterations);
  bytes.set(header.salt, BACKUP_MAGIC.length + 10);
  return bytes;
}

export function decodeBackupHeader(bytes: Uint8Array): BackupHeader {
  if (bytes.length < BACKUP_HEADER_BYTES) {
    throw new BackupFormatError("En-tête de sauvegarde tronqué.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, BACKUP_HEADER_BYTES);
  const magic = readAscii(view, 0, BACKUP_MAGIC.length);
  if (magic !== BACKUP_MAGIC) {
    throw new BackupFormatError("Ce fichier n'est pas une sauvegarde Wallet.");
  }
  const formatVersion = readU32(view, BACKUP_MAGIC.length);
  if (formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupFormatError("Version de sauvegarde non prise en charge.");
  }
  const kdfId = readU16(view, BACKUP_MAGIC.length + 4);
  const iterations = readU32(view, BACKUP_MAGIC.length + 6);
  if (iterations < 1 || iterations > KDF_MAX_ITERATIONS) {
    throw new BackupFormatError("Paramètres de sauvegarde invalides.");
  }
  const salt = bytes.slice(BACKUP_MAGIC.length + 10, BACKUP_HEADER_BYTES);
  return { formatVersion, kdfId, iterations, salt };
}

export function isBackupFile(bytes: Uint8Array): boolean {
  if (bytes.length < BACKUP_MAGIC.length) {
    return false;
  }
  for (let i = 0; i < BACKUP_MAGIC.length; i++) {
    if (bytes[i] !== BACKUP_MAGIC.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

export function isPlainBackupFile(bytes: Uint8Array): boolean {
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

export function detectBackupFormat(bytes: Uint8Array): BackupStorageFormat {
  if (isBackupFile(bytes)) {
    return "encrypted";
  }
  if (isPlainBackupFile(bytes)) {
    return "plain";
  }
  throw new BackupFormatError("Ce fichier n'est pas une sauvegarde Wallet.");
}
