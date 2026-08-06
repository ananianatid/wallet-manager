import type { SQLiteDatabase } from "expo-sqlite";

export const DATABASE_VERSION = 11;

export const SCHEMA_VERSION_1 = `
CREATE TABLE categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  type    TEXT NOT NULL CHECK (type IN ('account','income','expense')),
  name    TEXT NOT NULL,
  is_seed INTEGER NOT NULL DEFAULT 0,
  icon    TEXT,
  UNIQUE (type, name)
);

CREATE TABLE account_groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE UNIQUE INDEX ux_account_groups_active_name
  ON account_groups (name) WHERE deleted_at IS NULL;

CREATE TABLE accounts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  category_id        INTEGER NOT NULL REFERENCES categories(id),
  group_id           INTEGER REFERENCES account_groups(id),
  hidden             INTEGER NOT NULL DEFAULT 0,
  exclude_from_total INTEGER NOT NULL DEFAULT 0,
  description        TEXT,
  created_at         INTEGER NOT NULL,
  deleted_at         INTEGER
);

CREATE INDEX idx_accounts_group ON accounts (group_id);

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

CREATE TABLE budgets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  created_at  INTEGER NOT NULL
);

CREATE UNIQUE INDEX ux_budgets_category ON budgets (category_id) WHERE category_id IS NOT NULL;

CREATE TABLE recurring_transactions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  type                   TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount                 INTEGER NOT NULL CHECK (amount > 0),
  category_id            INTEGER REFERENCES categories(id),
  account_id             INTEGER NOT NULL REFERENCES accounts(id),
  destination_account_id INTEGER REFERENCES accounts(id),
  fee                    INTEGER CHECK (fee IS NULL OR fee > 0),
  note                   TEXT,
  frequency              TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  interval               INTEGER NOT NULL DEFAULT 1 CHECK (interval > 0),
  start_date             INTEGER NOT NULL,
  next_date              INTEGER NOT NULL,
  end_date               INTEGER,
  is_active              INTEGER NOT NULL DEFAULT 1,
  created_at             INTEGER NOT NULL
);

CREATE TABLE savings_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  percent     INTEGER NOT NULL CHECK (percent > 0 AND percent <= 100),
  created_at  INTEGER NOT NULL,
  start_date  INTEGER,
  subtract_from_available INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX ux_savings_rules_category ON savings_rules (category_id) WHERE category_id IS NOT NULL;

CREATE TABLE goals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  target_amount INTEGER NOT NULL CHECK (target_amount > 0),
  target_date   INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at    INTEGER NOT NULL
);

CREATE TABLE goal_reservations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id            INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  source_account_id  INTEGER NOT NULL REFERENCES accounts(id),
  amount             INTEGER NOT NULL CHECK (amount > 0),
  note               TEXT,
  reservation_date   INTEGER NOT NULL,
  created_at         INTEGER NOT NULL,
  released_at        INTEGER
);

CREATE INDEX idx_goal_reservations_goal ON goal_reservations (goal_id);
CREATE INDEX idx_goal_reservations_source ON goal_reservations (source_account_id);
`;

export const SEED_CATEGORIES: Record<string, string[]> = {
  account: [
    "Compte courant",
    "Épargne",
    "Espèces",
    "Mobile Money",
    "Autre",
  ],
  income: [
    "Salaire",
    "Virement reçu",
    "Cadeau",
    "Remboursement",
    "Autre",
  ],
  expense: [
    "Nourriture",
    "Transport",
    "Logement",
    "Factures",
    "Santé",
    "Éducation",
    "Loisirs",
    "Shopping",
    "Autre",
  ],
};

export async function seedCategories(db: SQLiteDatabase): Promise<void> {
  for (const [type, names] of Object.entries(SEED_CATEGORIES)) {
    for (const name of names) {
      await db.runAsync(
        "INSERT INTO categories (type, name, is_seed, icon) VALUES (?, ?, 1, ?)",
        type,
        name,
        type === "account" ? null : "tag",
      );
    }
  }
}

export const SEED_ACCOUNT_GROUPS = [
  "Espèces",
  "Banque",
  "Carte de crédit",
  "Carte de débit",
  "Épargne",
  "Investissement",
  "Découvert",
  "Prêt",
  "Assurance",
  "Autres",
];

export async function seedAccountGroups(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();
  for (let i = 0; i < SEED_ACCOUNT_GROUPS.length; i++) {
    await db.runAsync(
      "INSERT INTO account_groups (name, sort_order, created_at) VALUES (?, ?, ?)",
      SEED_ACCOUNT_GROUPS[i],
      i,
      now,
    );
  }
}

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentDbVersion = row?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(SCHEMA_VERSION_1);
    await seedCategories(db);
    await seedAccountGroups(db);
  } else {
    if (currentDbVersion <= 1) {
      await db.execAsync(`
        ALTER TABLE accounts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE accounts ADD COLUMN exclude_from_total INTEGER NOT NULL DEFAULT 0;
      `);
    }
    if (currentDbVersion <= 2) {
      await db.execAsync(`
        CREATE TABLE budgets (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
          amount      INTEGER NOT NULL CHECK (amount > 0),
          created_at  INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX ux_budgets_category ON budgets (category_id) WHERE category_id IS NOT NULL;

        CREATE TABLE recurring_transactions (
          id                     INTEGER PRIMARY KEY AUTOINCREMENT,
          type                   TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
          amount                 INTEGER NOT NULL CHECK (amount > 0),
          category_id            INTEGER REFERENCES categories(id),
          account_id             INTEGER NOT NULL REFERENCES accounts(id),
          destination_account_id INTEGER REFERENCES accounts(id),
          fee                    INTEGER CHECK (fee IS NULL OR fee > 0),
          note                   TEXT,
          frequency              TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
          interval               INTEGER NOT NULL DEFAULT 1 CHECK (interval > 0),
          start_date             INTEGER NOT NULL,
          next_date              INTEGER NOT NULL,
          end_date               INTEGER,
          is_active              INTEGER NOT NULL DEFAULT 1,
          created_at             INTEGER NOT NULL
        );
      `);
    }
    if (currentDbVersion <= 3) {
      await db.execAsync(`
        CREATE TABLE savings_rules (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
          percent     INTEGER NOT NULL CHECK (percent > 0 AND percent <= 100),
          created_at  INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX ux_savings_rules_category ON savings_rules (category_id) WHERE category_id IS NOT NULL;
      `);
    }
    if (currentDbVersion <= 4) {
      await db.execAsync(`
        CREATE TABLE goals (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          name          TEXT NOT NULL,
          target_amount INTEGER NOT NULL CHECK (target_amount > 0),
          target_date   INTEGER NOT NULL,
          status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
          created_at    INTEGER NOT NULL
        );

        CREATE TABLE goal_reservations (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          goal_id            INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
          source_account_id  INTEGER NOT NULL REFERENCES accounts(id),
          amount             INTEGER NOT NULL CHECK (amount > 0),
          note               TEXT,
          reservation_date   INTEGER NOT NULL,
          created_at         INTEGER NOT NULL,
          released_at        INTEGER
        );

        CREATE INDEX idx_goal_reservations_goal ON goal_reservations (goal_id);
        CREATE INDEX idx_goal_reservations_source ON goal_reservations (source_account_id);
      `);
    }
    if (currentDbVersion <= 5) {
      await db.execAsync(`
        ALTER TABLE categories ADD COLUMN icon TEXT;
        UPDATE categories SET icon = 'tag' WHERE type IN ('income', 'expense');
      `);
    }
    if (currentDbVersion <= 6) {
      await db.execAsync(`
        ALTER TABLE accounts ADD COLUMN description TEXT;
      `);
    }
    if (currentDbVersion <= 7) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS account_groups (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          deleted_at INTEGER
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_account_groups_active_name
          ON account_groups (name) WHERE deleted_at IS NULL;

        ALTER TABLE accounts ADD COLUMN group_id INTEGER REFERENCES account_groups(id);
        CREATE INDEX IF NOT EXISTS idx_accounts_group ON accounts (group_id);

        INSERT INTO account_groups (name, sort_order, created_at)
        SELECT c.name,
               ROW_NUMBER() OVER (ORDER BY MIN(a.id)) AS sort_order,
               MIN(a.created_at) AS created_at
        FROM accounts a
        JOIN categories c ON c.id = a.category_id
        GROUP BY c.name;

        UPDATE accounts
        SET group_id = (
          SELECT g.id FROM account_groups g
          JOIN categories c ON c.id = accounts.category_id
          WHERE g.name = c.name AND g.deleted_at IS NULL
        )
        WHERE group_id IS NULL;
      `);
    }
    if (currentDbVersion <= 8) {
      await db.execAsync(`
        ALTER TABLE accounts ADD COLUMN deleted_at INTEGER;
      `);
    }
    if (currentDbVersion <= 9) {
      await db.execAsync(`
        ALTER TABLE savings_rules ADD COLUMN start_date INTEGER;
      `);
    }
    if (currentDbVersion <= 10) {
      await db.execAsync(`
        ALTER TABLE savings_rules
          ADD COLUMN subtract_from_available INTEGER NOT NULL DEFAULT 0;
      `);
      const settingsTable = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
      );
      if (settingsTable) {
        const legacySetting = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM settings WHERE key = 'savings_subtract_from_available'",
        );
        if (legacySetting?.value === "1") {
          await db.runAsync(
            "UPDATE savings_rules SET subtract_from_available = 1",
          );
        }
      }
    }
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
