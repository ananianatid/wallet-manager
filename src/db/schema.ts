import type { SQLiteDatabase } from "expo-sqlite";

export const DATABASE_VERSION = 4;

export const SCHEMA_VERSION_1 = `
CREATE TABLE categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  type    TEXT NOT NULL CHECK (type IN ('account','income','expense')),
  name    TEXT NOT NULL,
  is_seed INTEGER NOT NULL DEFAULT 0,
  UNIQUE (type, name)
);

CREATE TABLE accounts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  category_id        INTEGER NOT NULL REFERENCES categories(id),
  hidden             INTEGER NOT NULL DEFAULT 0,
  exclude_from_total INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL
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
  created_at  INTEGER NOT NULL
);

CREATE UNIQUE INDEX ux_savings_rules_category ON savings_rules (category_id) WHERE category_id IS NOT NULL;
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
        "INSERT INTO categories (type, name, is_seed) VALUES (?, ?, 1)",
        type,
        name,
      );
    }
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
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
