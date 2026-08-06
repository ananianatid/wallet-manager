import {
  BACKUP_FORMAT_VERSION,
  BACKUP_HEADER_BYTES,
  BACKUP_MAGIC,
  BackupFormatError,
  KDF_ID_PBKDF2_SHA256,
  KDF_SALT_BYTES,
  decodeBackupHeader,
  encodeBackupHeader,
  isBackupFile,
} from "./backup-format";

const SALT = Uint8Array.from({ length: KDF_SALT_BYTES }, (_, i) => i + 1);

describe("encodeBackupHeader", () => {
  it("produit un en-tête de la taille attendue", () => {
    const bytes = encodeBackupHeader({
      formatVersion: BACKUP_FORMAT_VERSION,
      kdfId: KDF_ID_PBKDF2_SHA256,
      iterations: 100_000,
      salt: SALT,
    });
    expect(bytes.length).toBe(BACKUP_HEADER_BYTES);
    expect(bytes.length).toBe(BACKUP_MAGIC.length + 4 + 2 + 4 + KDF_SALT_BYTES);
  });

  it("rejette un sel de mauvaise longueur", () => {
    expect(() =>
      encodeBackupHeader({
        formatVersion: BACKUP_FORMAT_VERSION,
        kdfId: KDF_ID_PBKDF2_SHA256,
        iterations: 100_000,
        salt: new Uint8Array(4),
      }),
    ).toThrow(BackupFormatError);
  });
});

describe("decodeBackupHeader", () => {
  it("fait un roundtrip", () => {
    const header = {
      formatVersion: BACKUP_FORMAT_VERSION,
      kdfId: KDF_ID_PBKDF2_SHA256,
      iterations: 100_000,
      salt: SALT,
    };
    const decoded = decodeBackupHeader(encodeBackupHeader(header));
    expect(decoded).toEqual(header);
  });

  it("rejette un fichier qui n'est pas une sauvegarde", () => {
    const bytes = new Uint8Array(BACKUP_HEADER_BYTES);
    bytes[0] = "X".charCodeAt(0);
    expect(() => decodeBackupHeader(bytes)).toThrow(BackupFormatError);
  });

  it("rejette un en-tête tronqué", () => {
    expect(() => decodeBackupHeader(new Uint8Array(8))).toThrow(
      BackupFormatError,
    );
  });

  it("rejette une version de format inconnue", () => {
    const header = encodeBackupHeader({
      formatVersion: BACKUP_FORMAT_VERSION,
      kdfId: KDF_ID_PBKDF2_SHA256,
      iterations: 100_000,
      salt: SALT,
    });
    new DataView(header.buffer).setUint32(BACKUP_MAGIC.length, 99);
    expect(() => decodeBackupHeader(header)).toThrow(BackupFormatError);
  });

  it("rejette un nombre d'itérations hors bornes", () => {
    const header = encodeBackupHeader({
      formatVersion: BACKUP_FORMAT_VERSION,
      kdfId: KDF_ID_PBKDF2_SHA256,
      iterations: 100_000,
      salt: SALT,
    });
    new DataView(header.buffer).setUint32(BACKUP_MAGIC.length + 6, 9_999_999);
    expect(() => decodeBackupHeader(header)).toThrow(BackupFormatError);
  });
});

describe("isBackupFile", () => {
  it("détecte le magic", () => {
    const header = encodeBackupHeader({
      formatVersion: BACKUP_FORMAT_VERSION,
      kdfId: KDF_ID_PBKDF2_SHA256,
      iterations: 100_000,
      salt: SALT,
    });
    expect(isBackupFile(header)).toBe(true);
    expect(isBackupFile(new Uint8Array(4))).toBe(false);
    const other = new Uint8Array(header.length);
    other.set(header);
    other[0] = "Y".charCodeAt(0);
    expect(isBackupFile(other)).toBe(false);
  });
});
