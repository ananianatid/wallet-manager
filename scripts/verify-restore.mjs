import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_HEADER_BYTES,
  BACKUP_MAGIC,
  GCM_IV_BYTES,
  GCM_TAG_BYTES,
  KDF_ID_PBKDF2_SHA256,
  KDF_SALT_BYTES,
  encodeBackupHeader,
} from "../src/security/backup-format.ts";
import {
  DATABASE_VERSION,
  SCHEMA_VERSION_1,
  migrateDbIfNeeded,
  seedAccountGroups,
  seedCategories,
} from "../src/db/schema.ts";

const ITERATIONS = 100_000;
const PASSPHRASE = "mot-de-passe-test";

const V1_SCHEMA = `
CREATE TABLE categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  type    TEXT NOT NULL CHECK (type IN ('account','income','expense')),
  name    TEXT NOT NULL,
  is_seed INTEGER NOT NULL DEFAULT 0,
  UNIQUE (type, name)
);
CREATE TABLE accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  created_at  INTEGER NOT NULL
);
CREATE TABLE transactions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  type                   TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount                 INTEGER NOT NULL CHECK (amount > 0),
  category_id            INTEGER REFERENCES categories(id),
  account_id             INTEGER NOT NULL REFERENCES accounts(id),
  destination_account_id INTEGER REFERENCES accounts(id),
  fee                    INTEGER CHECK (fee IS NULL OR fee > 0),
  note                   TEXT,
  transaction_date       INTEGER NOT NULL,
  created_at             INTEGER NOT NULL
);
CREATE INDEX idx_transactions_account ON transactions (account_id);
CREATE INDEX idx_transactions_destination ON transactions (destination_account_id);
CREATE INDEX idx_transactions_date ON transactions (transaction_date);
`;

class WalletDbShim {
  constructor(file) {
    this.db = new DatabaseSync(file);
  }
  async execAsync(sql) {
    this.db.exec(sql);
  }
  async runAsync(sql, ...params) {
    const result = this.db.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
  }
  async getFirstAsync(sql, ...params) {
    return this.db.prepare(sql).get(...params) ?? null;
  }
  async getAllAsync(sql, ...params) {
    return this.db.prepare(sql).all(...params);
  }
  async withTransactionAsync(task) {
    this.db.exec("BEGIN");
    try {
      await task();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}

let failures = 0;
const expect = (label, actual, wanted) => {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  console.log(
    `${ok ? "OK" : "ÉCHEC"}  ${label}: ${JSON.stringify(actual)} (attendu ${JSON.stringify(wanted)})`,
  );
  if (!ok) failures++;
};

function encryptBackup(plaintext) {
  const salt = randomBytes(KDF_SALT_BYTES);
  const iv = randomBytes(GCM_IV_BYTES);
  const header = encodeBackupHeader({
    formatVersion: BACKUP_FORMAT_VERSION,
    kdfId: KDF_ID_PBKDF2_SHA256,
    iterations: ITERATIONS,
    salt: Buffer.from(salt),
  });
  const key = Buffer.from(pbkdf2(sha256, PASSPHRASE, salt, { c: ITERATIONS, dkLen: 32 }));
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(header));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from(header), iv, ciphertext, tag]);
}

function decryptBackup(file, passphrase) {
  const header = new Uint8Array(file.subarray(0, BACKUP_HEADER_BYTES));
  const magic = file.subarray(0, BACKUP_MAGIC.length).toString("ascii");
  if (magic !== BACKUP_MAGIC) throw new Error("magic invalide");
  const salt = file.subarray(BACKUP_MAGIC.length + 10, BACKUP_HEADER_BYTES);
  const iv = file.subarray(BACKUP_HEADER_BYTES, BACKUP_HEADER_BYTES + GCM_IV_BYTES);
  const tag = file.subarray(file.length - GCM_TAG_BYTES);
  const ciphertext = file.subarray(
    BACKUP_HEADER_BYTES + GCM_IV_BYTES,
    file.length - GCM_TAG_BYTES,
  );
  const key = Buffer.from(pbkdf2(sha256, passphrase, salt, { c: ITERATIONS, dkLen: 32 }));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(header));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

const NOW = 1_700_000_000_000;

function seedRows(db) {
  db.prepare("INSERT INTO categories (type, name, is_seed, icon) VALUES (?, ?, 1, ?)").run(
    "account", "Banque", null,
  );
  db.prepare("INSERT INTO categories (type, name, is_seed, icon) VALUES (?, ?, 1, ?)").run(
    "account", "Espèces", null,
  );
  db.prepare("INSERT INTO categories (type, name, is_seed, icon) VALUES (?, ?, 1, ?)").run(
    "income", "Salaire", "tag",
  );
  db.prepare("INSERT INTO categories (type, name, is_seed, icon) VALUES (?, ?, 1, ?)").run(
    "expense", "Nourriture", "tag",
  );
  db.prepare(
    `INSERT INTO accounts (id, name, category_id, created_at)
     VALUES (1, 'Compte A', 1, ${NOW}), (2, 'Compte B', 2, ${NOW})`,
  ).run();
  db.prepare(
    `INSERT INTO transactions
       (type, amount, category_id, account_id, destination_account_id, fee, note, transaction_date, created_at)
     VALUES
       ('income', 250000, 3, 1, NULL, NULL, 'Salaire', ${NOW}, ${NOW}),
       ('expense', 30000, 4, 2, NULL, NULL, NULL, ${NOW}, ${NOW}),
       ('transfer', 50000, NULL, 1, 2, 1000, NULL, ${NOW}, ${NOW})`,
  ).run();
  db.prepare(
    `UPDATE transactions
     SET destination_amount = 50000, exchange_rate = 1,
         exchange_rate_date = '2024-01-01', exchange_rate_provider = 'same currency'
     WHERE type = 'transfer'`,
  ).run();
  db.prepare(
    `INSERT INTO budgets (category_id, amount, created_at) VALUES (4, 75000, ${NOW})`,
  ).run();
  db.prepare(
    `INSERT INTO goals (id, name, target_amount, target_date, status, created_at)
     VALUES (1, 'Objectif A', 300000, ${NOW + 86_400_000}, 'active', ${NOW})`,
  ).run();
  db.prepare(
    `INSERT INTO goal_reservations (goal_id, source_account_id, amount, reservation_date, created_at)
     VALUES (1, 1, 50000, ${NOW}, ${NOW})`,
  ).run();
  db.prepare(
    `INSERT INTO recurring_transactions
       (type, amount, category_id, account_id, frequency, interval, start_date, next_date, is_active, created_at)
     VALUES ('expense', 15000, 4, 1, 'monthly', 1, ${NOW}, ${NOW}, 1, ${NOW})`,
  ).run();
  db.prepare("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
  db.prepare("INSERT INTO settings (key, value) VALUES ('base_currency', 'XOF')").run();
}

function buildCurrentSource(path) {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA_VERSION_1);
  seedRows(db);
  db.exec(`PRAGMA user_version = ${DATABASE_VERSION}`);
  db.close();
}

function buildOldSource(path, version) {
  const db = new DatabaseSync(path);
  db.exec(V1_SCHEMA);
  db.prepare("INSERT INTO categories (type, name, is_seed) VALUES (?, ?, 1)").run(
    "account", "Banque",
  );
  db.prepare("INSERT INTO categories (type, name, is_seed) VALUES (?, ?, 1)").run(
    "income", "Salaire",
  );
  db.prepare(
    `INSERT INTO accounts (id, name, category_id, created_at) VALUES (1, 'Compte A', 1, ${NOW})`,
  ).run();
  db.prepare(
    `INSERT INTO transactions
       (type, amount, category_id, account_id, transaction_date, created_at)
     VALUES ('income', 120000, 2, 1, ${NOW}, ${NOW})`,
  ).run();
  db.prepare("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
  db.prepare("INSERT INTO settings (key, value) VALUES ('base_currency', 'XOF')").run();
  db.exec(`PRAGMA user_version = ${version}`);
  db.close();
}

function snapshot(db) {
  const tables = [
    "categories",
    "accounts",
    "transactions",
    "budgets",
    "goals",
    "goal_reservations",
    "recurring_transactions",
    "settings",
  ];
  const out = {};
  for (const table of tables) {
    out[table] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  }
  out.balances = db
    .prepare(
      `SELECT a.id AS id,
         COALESCE((
           SELECT SUM(CASE
             WHEN t.type = 'income' THEN t.amount
             WHEN t.type = 'expense' THEN -t.amount
             WHEN t.type = 'transfer' THEN
               CASE WHEN t.account_id = a.id THEN -(t.amount + COALESCE(t.fee, 0))
                    ELSE COALESCE(t.destination_amount, t.amount) END
           END)
           FROM transactions t
           WHERE (t.account_id = a.id OR t.destination_account_id = a.id)
             AND (SELECT a2.deleted_at FROM accounts a2 WHERE a2.id = t.account_id) IS NULL
             AND (SELECT a2.deleted_at FROM accounts a2 WHERE a2.id = t.destination_account_id) IS NULL
         ), 0) AS balance
       FROM accounts a ORDER BY a.id`,
    )
    .all()
    .map((row) => ({ id: row.id, balance: Number(row.balance) }));
  return out;
}

function validateBackupBytes(bytes) {
  const version = new DatabaseSync(":memory:");
  try {
    const path = join(tmpdir(), `wallet-probe-${Date.now()}-${Math.random()}.db`);
    writeFileSync(path, bytes);
    const probe = new DatabaseSync(path);
    try {
      const row = probe.prepare("PRAGMA user_version").get();
      const userVersion = Number(row.user_version);
      if (userVersion < 1 || userVersion > DATABASE_VERSION) {
        throw new Error(`version incompatible (v${userVersion}, app en v${DATABASE_VERSION})`);
      }
      const tables = probe
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((r) => r.name);
      for (const required of ["categories", "accounts", "transactions", "settings"]) {
        if (!tables.includes(required)) {
          throw new Error(`table requise « ${required} » absente`);
        }
      }
      return { userVersion, tables };
    } finally {
      probe.close();
    }
  } finally {
    version.close();
  }
}

const tmp = mkdtempSync(join(tmpdir(), "wallet-verify-restore-"));

try {
  console.log("=== Scénario A : sauvegarde actuelle, restauration à l'identique ===");
  const currentPath = join(tmp, "current.db");
  const restoredCurrentPath = join(tmp, "restored-current.db");
  buildCurrentSource(currentPath);
  const currentBytes = readFileSync(currentPath);
  expect(
    "export : magic SQLite",
    currentBytes.subarray(0, 16).toString("ascii"),
    "SQLite format 3\u0000",
  );
  const backupA = encryptBackup(currentBytes);
  writeFileSync(join(tmp, "backup-a.wlbak"), backupA);

  const plainA = decryptBackup(readFileSync(join(tmp, "backup-a.wlbak")), PASSPHRASE);
  const infoA = validateBackupBytes(plainA);
  expect("user_version de la sauvegarde", infoA.userVersion, DATABASE_VERSION);

  writeFileSync(restoredCurrentPath, plainA);
  const walletA = new WalletDbShim(restoredCurrentPath);
  await migrateDbIfNeeded(walletA);
  expect(
    "intégrité SQLite",
    walletA.db.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
  expect(
    "user_version après restauration",
    Number(walletA.db.prepare("PRAGMA user_version").get().user_version),
    DATABASE_VERSION,
  );
  const currentSource = new DatabaseSync(currentPath);
  const sourceSnapA = snapshot(currentSource);
  currentSource.close();
  const restoredSnapA = snapshot(walletA.db);
  expect("données identiques à la source", restoredSnapA, sourceSnapA);
  const transfer = walletA.db
    .prepare("SELECT amount, fee, destination_amount FROM transactions WHERE type = 'transfer'")
    .get();
  expect("transfert restauré (frais + montant destination)", transfer, {
    amount: 50000,
    fee: 1000,
    destination_amount: 50000,
  });

  console.log("\n=== Scénario B : vieille sauvegarde v1 restaurée puis migrée ===");
  const oldPath = join(tmp, "old.db");
  buildOldSource(oldPath, 1);
  const backupB = encryptBackup(readFileSync(oldPath));
  writeFileSync(join(tmp, "backup-b.wlbak"), backupB);

  const plainB = decryptBackup(readFileSync(join(tmp, "backup-b.wlbak")), PASSPHRASE);
  const infoB = validateBackupBytes(plainB);
  expect("user_version de la vieille sauvegarde", infoB.userVersion, 1);

  const restoredOldPath = join(tmp, "restored-old.db");
  writeFileSync(restoredOldPath, plainB);
  const walletB = new WalletDbShim(restoredOldPath);
  await migrateDbIfNeeded(walletB);
  expect(
    "migration après restauration",
    Number(walletB.db.prepare("PRAGMA user_version").get().user_version),
    DATABASE_VERSION,
  );
  const oldIncome = walletB.db
    .prepare("SELECT amount, type FROM transactions")
    .all();
  expect("transaction v1 préservée", oldIncome, [{ amount: 120000, type: "income" }]);
  const account = walletB.db
    .prepare("SELECT name, currency_code FROM accounts WHERE id = 1")
    .get();
  expect("compte v1 migré (devise)", account, { name: "Compte A", currency_code: "XOF" });
  const columns = walletB.db
    .prepare("PRAGMA table_info(transactions)")
    .all()
    .map((c) => c.name);
  expect("colonnes devise présentes", columns.includes("destination_amount"), true);

  console.log("\n=== Cas négatifs ===");
  try {
    decryptBackup(readFileSync(join(tmp, "backup-a.wlbak")), "mauvais-mot-de-passe");
    console.error("ÉCHEC  mauvais mot de passe accepté.");
    failures++;
  } catch {
    console.log("OK  rejet du mauvais mot de passe");
  }

  const tampered = Buffer.from(readFileSync(join(tmp, "backup-a.wlbak")));
  tampered[0] = "X".charCodeAt(0);
  try {
    decryptBackup(tampered, PASSPHRASE);
    console.error("ÉCHEC  fichier altéré accepté.");
    failures++;
  } catch {
    console.log("OK  rejet du fichier altéré (AAD)");
  }

  const tooNewPath = join(tmp, "too-new.db");
  const tooNew = new DatabaseSync(tooNewPath);
  tooNew.exec(SCHEMA_VERSION_1);
  tooNew.exec(`PRAGMA user_version = ${DATABASE_VERSION + 1}`);
  tooNew.close();
  try {
    validateBackupBytes(readFileSync(tooNewPath));
    console.error("ÉCHEC  sauvegarde de version future acceptée.");
    failures++;
  } catch {
    console.log("OK  rejet d'une sauvegarde de version future");
  }

  if (failures === 0) {
    console.log(
      `\nRestauration de bout en bout vérifiée (${ITERATIONS} itérations PBKDF2-SHA256, AES-256-GCM).`,
    );
  } else {
    console.error(`\n${failures} échec(s).`);
    process.exitCode = 1;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
