import { DatabaseSync } from "node:sqlite";
import { migrateDbIfNeeded } from "../src/db/schema.ts";
import {
  listAccountGroups,
  listDeletedAccountGroups,
  createAccountGroup,
  renameAccountGroup,
  softDeleteAccountGroup,
  restoreAccountGroup,
  assignAccountGroup,
  reorderAccountGroups,
} from "../src/db/account-groups.ts";
// NOTE: accounts.ts is intentionally NOT imported — its runtime imports are extensionless
// (./categories, ./transactions) and fail ESM resolution. Account rows are inserted via raw SQL.

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
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}: ${JSON.stringify(actual)} (attendu ${JSON.stringify(wanted)})`);
};

// --- Scenario 1: fresh install (v0) ---
const db = new WalletDbShim(":memory:");
await migrateDbIfNeeded(db);

const groups0 = await listAccountGroups(db);
expect("10 groupes seedés", groups0.length, 10);
expect("1er groupe", groups0[0].name, "Espèces");
expect("dernier groupe", groups0[9].name, "Autres");

// accountCount = 0 initially
expect("compteCount initial 0", groups0.map((g) => g.accountCount), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

// create account with groupId (raw SQL; account-groups module only)
await db.runAsync(
  "INSERT INTO accounts (name, category_id, group_id, created_at) VALUES (?, ?, ?, ?)",
  "Caisse",
  1,
  groups0[0].id,
  1000,
);
const accounts = db.db
  .prepare("SELECT id, group_id AS groupId FROM accounts")
  .all();
expect("compte créé avec groupe", accounts[0].groupId, groups0[0].id);

const groups1 = await listAccountGroups(db);
expect("compteCount après création", groups1[0].accountCount, 1);

// duplicate create → UNIQUE error
let dupError = null;
try {
  await createAccountGroup(db, "Espèces");
} catch (e) {
  dupError = e.message;
}
expect("doublon rejeté", dupError, "Un groupe de comptes porte déjà ce nom.");

// create + rename
const newId = await createAccountGroup(db, "Test");
await renameAccountGroup(db, newId, "Test renommé");
const groups2 = await listAccountGroups(db);
expect("renommage", groups2.find((g) => g.id === newId).name, "Test renommé");
expect("nouveau groupe en dernier (sort_order max+1)", groups2[10].id, newId);

// assign + count
await assignAccountGroup(db, accounts[0].id, newId);
const groups3 = await listAccountGroups(db);
expect("compte affecté au nouveau groupe", groups3.find((g) => g.id === newId).accountCount, 1);
expect("compte retiré de l'ancien", groups3.find((g) => g.id === groups0[0].id).accountCount, 0);

// unassign
await assignAccountGroup(db, accounts[0].id, null);
const groups4 = await listAccountGroups(db);
expect("compte détaché", groups4.find((g) => g.id === newId).accountCount, 0);

// soft delete detaches accounts
await assignAccountGroup(db, accounts[0].id, newId);
await softDeleteAccountGroup(db, newId);
const groups5 = await listAccountGroups(db);
expect("groupe retiré des actifs", groups5.some((g) => g.id === newId), false);
const deleted = await listDeletedAccountGroups(db);
expect("groupe dans les supprimés", deleted[0].name, "Test renommé");
const accounts2 = db.db.prepare("SELECT group_id AS groupId FROM accounts").all();
expect("compte détaché au soft delete", accounts2[0].groupId, null);

// restore collides? no active "Test renommé" → ok
await restoreAccountGroup(db, newId);
const groups6 = await listAccountGroups(db);
expect("groupe restauré", groups6.some((g) => g.id === newId), true);

// restore collision with an active name
const collisionA = await createAccountGroup(db, "Collision");
await softDeleteAccountGroup(db, collisionA); // "Collision" now deleted
const collisionB = await createAccountGroup(db, "Collision"); // active, same name (allowed: only active names unique)
let restoreErr = null;
try {
  await restoreAccountGroup(db, collisionA); // would collide with active collisionB
} catch (e) {
  restoreErr = e.message;
}
expect("restauration collision rejetée", restoreErr, "Un groupe actif porte déjà ce nom.");

// reorder
const ids = (await listAccountGroups(db)).map((g) => g.id);
const reversed = [...ids].reverse();
await reorderAccountGroups(db, reversed);
const groups7 = await listAccountGroups(db);
expect("réordonnancement persisté", groups7.map((g) => g.id), reversed);

// soft-delete puis restauration (plus de suppression définitive)
const g = groups7[0];
await softDeleteAccountGroup(db, g.id);
const gDel = await listDeletedAccountGroups(db);
expect("groupe déplacé dans les supprimés", gDel.some((x) => x.id === g.id), true);
await restoreAccountGroup(db, g.id);
const gRestored = await listAccountGroups(db);
expect("groupe restauré", gRestored.some((x) => x.id === g.id), true);

// --- Soft-delete des comptes (SQL brut, accounts.ts non importable en ESM) ---
const colExists = db.db
  .prepare("PRAGMA table_info(accounts)")
  .all()
  .some((c) => c.name === "deleted_at");
expect("colonne accounts.deleted_at", colExists, true);

const caisse = db.db.prepare("SELECT id FROM accounts WHERE name = 'Caisse'").get();
await db.runAsync(
  "INSERT INTO transactions (type, amount, account_id, transaction_date, created_at) VALUES ('income', 500, ?, 1000, 1000)",
  caisse.id,
);

const activeBefore = db.db
  .prepare(
    `SELECT COALESCE((
       SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
       FROM transactions t
       WHERE (t.account_id = a.id OR t.destination_account_id = a.id)
         AND (SELECT x.deleted_at FROM accounts x WHERE x.id = t.account_id) IS NULL
         AND (SELECT x.deleted_at FROM accounts x WHERE x.id = t.destination_account_id) IS NULL
     ), 0) AS balance
     FROM accounts a WHERE a.deleted_at IS NULL AND a.name = 'Caisse'`,
  )
  .get();
expect("compte actif visible avec solde", Number(activeBefore.balance), 500);

// soft-delete (équivalent SQL de deleteAccount)
await db.runAsync("UPDATE accounts SET deleted_at = ? WHERE id = ?", 9999, caisse.id);

const activeAfter = db.db
  .prepare("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND name = 'Caisse'")
  .get();
expect("compte supprimé exclu des actifs", Number(activeAfter.n), 0);

// filtre de transactions (équivalent SQL de FROM_JOINS de transactions.ts)
const txVisible = db.db
  .prepare(
    `SELECT COUNT(*) AS n FROM transactions t
     JOIN accounts a ON a.id = t.account_id AND a.deleted_at IS NULL
     WHERE t.id = ?`,
  )
  .get();
expect("transaction du compte supprimé masquée", Number(txVisible.n), 0);

// restauration (équivalent SQL de restoreAccount)
await db.runAsync("UPDATE accounts SET deleted_at = NULL WHERE id = ?", caisse.id);
const restored = db.db
  .prepare("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND name = 'Caisse'")
  .get();
expect("compte restauré réapparaît", Number(restored.n), 1);

// --- Scenario 2: existing v7 install → migrate + backfill ---
const old = new WalletDbShim(":memory:");
// v1 core tables WITHOUT account_groups/group_id/icon/hidden/exclude_from_total/description
await old.execAsync(`
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('account','income','expense')),
    name TEXT NOT NULL,
    is_seed INTEGER NOT NULL DEFAULT 0,
    UNIQUE (type, name)
  );
  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE savings_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    percent     INTEGER NOT NULL CHECK (percent > 0 AND percent <= 100),
    created_at  INTEGER NOT NULL
  );
`);
await old.runAsync("INSERT INTO categories (type, name, is_seed) VALUES ('account', 'Banque', 1)");
await old.runAsync("INSERT INTO categories (type, name, is_seed) VALUES ('account', 'Espèces', 1)");
await old.runAsync("INSERT INTO accounts (name, category_id, created_at) VALUES ('Ecobank', 1, 1000)");
await old.runAsync("INSERT INTO accounts (name, category_id, created_at) VALUES ('Caisse', 2, 2000)");
await old.runAsync("INSERT INTO accounts (name, category_id, created_at) VALUES ('Momo', 2, 3000)");
await old.db.exec("PRAGMA user_version = 7");

await migrateDbIfNeeded(old);

const oldColExists = old.db
  .prepare("PRAGMA table_info(accounts)")
  .all()
  .some((c) => c.name === "deleted_at");
expect("migration v9 ajoute accounts.deleted_at", oldColExists, true);

const savingsStartCol = old.db
  .prepare("PRAGMA table_info(savings_rules)")
  .all()
  .some((c) => c.name === "start_date");
expect("migration v10 ajoute savings_rules.start_date", savingsStartCol, true);

const migratedGroups = await old.db.prepare(
  "SELECT g.name, COUNT(a.id) AS n FROM account_groups g LEFT JOIN accounts a ON a.group_id = g.id GROUP BY g.id ORDER BY g.sort_order",
).all();
expect("backfill: Banque", migratedGroups.find((g) => g.name === "Banque").n, 1);
expect("backfill: Espèces", migratedGroups.find((g) => g.name === "Espèces").n, 2);
expect("aucun compte sans groupe", old.db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE group_id IS NULL").get().n, 0);

console.log(failures === 0 ? "\nToutes les vérifications passent." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
