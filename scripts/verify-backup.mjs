import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const MAGIC = "WLTBKUP1";
const FORMAT_VERSION = 1;
const KDF_ID_PBKDF2_SHA256 = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ITERATIONS = 100_000;

function encodeHeader({ version, kdfId, iterations, salt }) {
  const buf = Buffer.alloc(MAGIC.length + 4 + 2 + 4 + SALT_BYTES);
  buf.write(MAGIC, 0, "ascii");
  buf.writeUInt32BE(version, MAGIC.length);
  buf.writeUInt16BE(kdfId, MAGIC.length + 4);
  buf.writeUInt32BE(iterations, MAGIC.length + 6);
  salt.copy(buf, MAGIC.length + 10);
  return buf;
}

function decodeHeader(buf) {
  const magic = buf.subarray(0, MAGIC.length).toString("ascii");
  if (magic !== MAGIC) {
    throw new Error("magic invalide");
  }
  const version = buf.readUInt32BE(MAGIC.length);
  const kdfId = buf.readUInt16BE(MAGIC.length + 4);
  const iterations = buf.readUInt32BE(MAGIC.length + 6);
  const salt = buf.subarray(MAGIC.length + 10, MAGIC.length + 10 + SALT_BYTES);
  return { version, kdfId, iterations, salt };
}

function encrypt(plaintext) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const header = encodeHeader({
    version: FORMAT_VERSION,
    kdfId: KDF_ID_PBKDF2_SHA256,
    iterations: ITERATIONS,
    salt,
  });
  const key = Buffer.from(pbkdf2(sha256, "mot-de-passe-test", salt, { c: ITERATIONS, dkLen: 32 }));
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([header, iv, ciphertext, tag]);
}

function decrypt(file, passphrase) {
  const header = decodeHeader(file.subarray(0, MAGIC.length + 4 + 2 + 4 + SALT_BYTES));
  if (header.version !== FORMAT_VERSION || header.kdfId !== KDF_ID_PBKDF2_SHA256) {
    throw new Error("en-tête non pris en charge");
  }
  const headerBytes = MAGIC.length + 4 + 2 + 4 + SALT_BYTES;
  const iv = file.subarray(headerBytes, headerBytes + IV_BYTES);
  const tag = file.subarray(file.length - TAG_BYTES);
  const ciphertext = file.subarray(headerBytes + IV_BYTES, file.length - TAG_BYTES);
  const key = Buffer.from(pbkdf2(sha256, passphrase, header.salt, { c: header.iterations, dkLen: 32 }));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(file.subarray(0, headerBytes));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

const plaintext = Buffer.from("SQLite format 3\u0000" + "x".repeat(2048), "latin1");
const file = encrypt(plaintext);

const roundtrip = decrypt(file, "mot-de-passe-test");
if (!roundtrip.equals(plaintext)) {
  console.error("ÉCHEC : le roundtrip ne correspond pas.");
  process.exit(1);
}
console.log("Roundtrip chiffré → déchiffré : OK");

try {
  decrypt(file, "mauvais-mot-de-passe");
  console.error("ÉCHEC : mauvais mot de passe accepté.");
  process.exit(1);
} catch {
  console.log("Rejet du mauvais mot de passe : OK");
}

const tampered = Buffer.from(file);
tampered[0] = "X".charCodeAt(0);
try {
  decrypt(tampered, "mot-de-passe-test");
  console.error("ÉCHEC : fichier altéré accepté.");
  process.exit(1);
} catch {
  console.log("Rejet du fichier altéré (AAD) : OK");
}

console.log(`\nFormat .wlbak vérifié (${ITERATIONS} itérations PBKDF2-SHA256, AES-256-GCM).`);
