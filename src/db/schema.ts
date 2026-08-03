import type { SQLiteDatabase } from "expo-sqlite";

export const DATABASE_VERSION = 1;

export const SCHEMA_VERSION_1 = `
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
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
