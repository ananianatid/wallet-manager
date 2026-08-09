import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  DATABASE_VERSION,
  MIGRATION_V10,
  MIGRATION_V11,
  MIGRATION_V12,
  MIGRATION_V13,
  MIGRATION_V2,
  MIGRATION_V3,
  MIGRATION_V4,
  MIGRATION_V5,
  MIGRATION_V6,
  MIGRATION_V7,
  MIGRATION_V8,
  MIGRATION_V9,
  SCHEMA_VERSION_1,
  migrateDbIfNeeded,
  seedAccountGroups,
  seedCategories,
} from "./schema";

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

const MIGRATIONS: Record<number, string> = {
  2: MIGRATION_V2,
  3: MIGRATION_V3,
  4: MIGRATION_V4,
  5: MIGRATION_V5,
  6: MIGRATION_V6,
  7: MIGRATION_V7,
  8: MIGRATION_V8,
  9: MIGRATION_V9,
  10: MIGRATION_V10,
  11: MIGRATION_V11,
  12: MIGRATION_V12,
  13: MIGRATION_V13,
};

class SqliteDb {
  db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(":memory:");
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: SQLInputValue[]): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.db.prepare(sql).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getFirstAsync<T>(sql: string, ...params: SQLInputValue[]): Promise<T | null> {
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: SQLInputValue[]): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }
}

const NOW = 1_700_000_000_000;

function seedBase(db: SqliteDb): void {
  db.db.exec(`
    INSERT INTO categories (type, name, is_seed) VALUES
      ('account', 'Banque', 1),
      ('account', 'Espèces', 1),
      ('income', 'Salaire', 1),
      ('expense', 'Nourriture', 1);
  `);
  db.db.exec(`
    INSERT INTO accounts (id, name, category_id, created_at) VALUES
      (1, 'Compte A', 1, ${NOW}),
      (2, 'Compte B', 2, ${NOW});
  `);
  db.db.exec(`
    INSERT INTO transactions
      (id, type, amount, category_id, account_id, destination_account_id, fee, note, transaction_date, created_at)
    VALUES
      (1, 'income', 100000, 3, 1, NULL, NULL, 'Salaire', ${NOW}, ${NOW}),
      (2, 'expense', 25000, 4, 1, NULL, NULL, NULL, ${NOW}, ${NOW}),
      (3, 'transfer', 30000, NULL, 1, 2, 500, NULL, ${NOW}, ${NOW});
  `);
}

function seedEraTables(db: SqliteDb, version: number): void {
  if (version === 3) {
    db.db.exec(`
      INSERT INTO budgets (id, category_id, amount, created_at) VALUES (1, 4, 50000, ${NOW});
      INSERT INTO recurring_transactions
        (id, type, amount, category_id, account_id, destination_account_id, fee, note,
         frequency, interval, start_date, next_date, end_date, is_active, created_at)
      VALUES
        (1, 'expense', 15000, 4, 1, NULL, NULL, NULL, 'monthly', 1, ${NOW}, ${NOW}, NULL, 1, ${NOW});
    `);
  }
  if (version === 4) {
    db.db.exec(`
      INSERT INTO savings_rules (id, category_id, percent, created_at) VALUES (1, 4, 10, ${NOW});
    `);
  }
  if (version === 5) {
    db.db.exec(`
      INSERT INTO goals (id, name, target_amount, target_date, status, created_at)
        VALUES (1, 'PS5', 350000, ${NOW + 86_400_000}, 'active', ${NOW});
      INSERT INTO goal_reservations (id, goal_id, source_account_id, amount, note, reservation_date, created_at)
        VALUES (1, 1, 1, 50000, NULL, ${NOW}, ${NOW});
    `);
  }
  if (version === 9) {
    db.db.exec(`UPDATE accounts SET deleted_at = ${NOW} WHERE id = 2;`);
  }
  if (version === 10) {
    db.db.exec(`UPDATE savings_rules SET start_date = ${NOW} WHERE id = 1;`);
    db.db.exec(`
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO settings (key, value)
        VALUES ('savings_subtract_from_available', '1');
    `);
  }
}

function buildStateAt(version: number): SqliteDb {
  const db = new SqliteDb();
  db.db.exec(V1_SCHEMA);
  seedBase(db);
  for (let v = 2; v <= version; v++) {
    db.db.exec(MIGRATIONS[v]);
    seedEraTables(db, v);
  }
  db.db.exec(`PRAGMA user_version = ${version}`);
  return db;
}

function migrate(db: SqliteDb): Promise<void> {
  return migrateDbIfNeeded(db as unknown as SQLiteDatabase);
}

function userVersion(db: SqliteDb): number {
  const row = db.db.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version;
}

function tableColumns(db: SqliteDb, table: string): string[] {
  return (db.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
    .map((column) => column.name)
    .sort();
}

function tableNames(db: SqliteDb): string[] {
  return (
    db.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string }[]
  )
    .map((row) => row.name)
    .sort();
}

function indexNames(db: SqliteDb): string[] {
  return (
    db.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string }[]
  )
    .map((row) => row.name)
    .sort();
}

function row(db: SqliteDb, table: string, id: number): Record<string, unknown> | undefined {
  return db.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
}

function assertMigratedState(db: SqliteDb, era: number): void {
  expect(userVersion(db)).toBe(DATABASE_VERSION);

  const accountCols = tableColumns(db, "accounts");
  for (const column of [
    "hidden",
    "exclude_from_total",
    "description",
    "group_id",
    "deleted_at",
    "currency_code",
  ]) {
    expect(accountCols).toContain(column);
  }
  for (const column of [
    "destination_amount",
    "exchange_rate",
    "exchange_rate_date",
    "exchange_rate_provider",
  ]) {
    expect(tableColumns(db, "transactions")).toContain(column);
  }
  expect(tableColumns(db, "categories")).toContain("icon");
  expect(tableColumns(db, "budgets")).toContain("currency_code");
  expect(tableColumns(db, "goals")).toContain("currency_code");
  expect(tableColumns(db, "savings_rules")).toContain("start_date");
  expect(tableColumns(db, "savings_rules")).toContain("subtract_from_available");
  expect(tableColumns(db, "goal_reservations")).toEqual(
    expect.arrayContaining([
      "reference_amount",
      "reference_currency",
      "exchange_rate",
      "exchange_rate_date",
      "exchange_rate_provider",
    ]),
  );
  expect(tableNames(db)).toEqual(
    expect.arrayContaining(["currencies", "fx_rates"]),
  );
  if (era >= 10) {
    expect(tableNames(db)).toContain("settings");
  }

  const accounts = db.db.prepare("SELECT id, name, deleted_at FROM accounts ORDER BY id").all() as {
    id: number;
    name: string;
    deleted_at: number | null;
  }[];
  expect(accounts.map((a) => a.name)).toEqual(["Compte A", "Compte B"]);
  expect(accounts[1].deleted_at).toBe(era >= 9 ? NOW : null);

  const transfer = row(db, "transactions", 3);
  expect(transfer).toMatchObject({
    amount: 30000,
    fee: 500,
    destination_amount: 30000,
    exchange_rate: 1,
    exchange_rate_provider: "migration",
  });
  const income = row(db, "transactions", 1);
  expect(income).toMatchObject({ amount: 100000, destination_amount: null });

  const categories = db.db.prepare("SELECT type, name, icon FROM categories ORDER BY id").all() as {
    type: string;
    name: string;
    icon: string | null;
  }[];
  expect(categories.map((c) => c.name)).toEqual([
    "Banque",
    "Espèces",
    "Salaire",
    "Nourriture",
  ]);
  for (const category of categories.slice(2)) {
    expect(category.icon).toBe("tag");
  }

  expect(tableNames(db)).toContain("account_groups");
  const groups = db.db
    .prepare("SELECT name FROM account_groups ORDER BY name")
    .all() as { name: string }[];
  expect(groups.map((g) => g.name)).toEqual(["Banque", "Espèces"]);

  if (era >= 3) {
    expect(row(db, "budgets", 1)).toMatchObject({ amount: 50000 });
    expect(row(db, "recurring_transactions", 1)).toMatchObject({
      amount: 15000,
      is_active: 1,
    });
  }
  if (era >= 4) {
    expect(row(db, "savings_rules", 1)).toMatchObject({ percent: 10 });
  }
  if (era >= 5) {
    expect(row(db, "goals", 1)).toMatchObject({ target_amount: 350000 });
    expect(row(db, "goal_reservations", 1)).toMatchObject({
      amount: 50000,
      reference_amount: 50000,
      reference_currency: "XOF",
      exchange_rate: 1,
      exchange_rate_provider: "migration",
    });
  }
  if (era === 10) {
    expect(row(db, "savings_rules", 1)).toMatchObject({
      start_date: NOW,
      subtract_from_available: 1,
    });
  }
  if (era === 11) {
    expect(row(db, "savings_rules", 1)).toMatchObject({
      start_date: NOW,
      subtract_from_available: 0,
    });
  }
}

describe("migrations versionnées", () => {
  for (let version = 1; version < DATABASE_VERSION; version++) {
    it(`migre une base v${version} vers v${DATABASE_VERSION} sans perte de données`, async () => {
      const db = buildStateAt(version);
      await migrate(db);
      assertMigratedState(db, version);
    });
  }

  it("installation neuve : schéma complet, seeds et version finale", async () => {
    const db = new SqliteDb();
    await migrate(db);

    expect(userVersion(db)).toBe(DATABASE_VERSION);
    expect(tableNames(db)).toEqual(
      expect.arrayContaining([
        "categories",
        "accounts",
        "transactions",
        "budgets",
        "recurring_transactions",
        "savings_rules",
        "goals",
        "goal_reservations",
        "account_groups",
        "currencies",
        "fx_rates",
      ]),
    );
    const categoryCount = db.db
      .prepare("SELECT COUNT(*) AS count FROM categories")
      .get() as { count: number };
    expect(Number(categoryCount.count)).toBe(19);
    const groupCount = db.db
      .prepare("SELECT COUNT(*) AS count FROM account_groups")
      .get() as { count: number };
    expect(Number(groupCount.count)).toBe(10);
  });

  it("la somme des migrations reproduit le schéma d'installation neuve", () => {
    const ladder = new SqliteDb();
    ladder.db.exec(V1_SCHEMA);
    for (let v = 2; v <= DATABASE_VERSION; v++) {
      ladder.db.exec(MIGRATIONS[v]);
    }
    const fresh = new SqliteDb();
    fresh.db.exec(SCHEMA_VERSION_1);

    expect(tableNames(ladder)).toEqual(tableNames(fresh));
    expect(indexNames(ladder)).toEqual(indexNames(fresh));
    for (const table of tableNames(fresh)) {
      expect(tableColumns(ladder, table)).toEqual(tableColumns(fresh, table));
    }
  });

  it("rejette un schéma non versionné sans erreur (idempotence)", async () => {
    const db = buildStateAt(DATABASE_VERSION - 1);
    await migrate(db);
    await migrate(db);
    expect(userVersion(db)).toBe(DATABASE_VERSION);
  });

  it("ne modifie pas une base déjà à jour", async () => {
    const db = buildStateAt(DATABASE_VERSION - 1);
    await migrate(db);
    const before = tableNames(db).join(",");
    const accountsBefore = tableColumns(db, "accounts").join(",");
    await migrate(db);
    expect(tableNames(db).join(",")).toBe(before);
    expect(tableColumns(db, "accounts").join(",")).toBe(accountsBefore);
    expect(userVersion(db)).toBe(DATABASE_VERSION);
  });

  it("les seeds ne sont exécutés que lors d'une installation neuve", async () => {
    const db = new SqliteDb();
    db.db.exec(SCHEMA_VERSION_1);
    await seedCategories(db as unknown as SQLiteDatabase);
    await seedAccountGroups(db as unknown as SQLiteDatabase);
    const count = db.db
      .prepare("SELECT COUNT(*) AS count FROM categories")
      .get() as { count: number };
    expect(Number(count.count)).toBe(19);
    const seeded = db.db
      .prepare("SELECT COUNT(*) AS count FROM categories WHERE is_seed = 1")
      .get() as { count: number };
    expect(Number(seeded.count)).toBe(19);
  });
});
