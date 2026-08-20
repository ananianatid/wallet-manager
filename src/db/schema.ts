import type { SQLiteDatabase } from "expo-sqlite";

export const DATABASE_VERSION = 18;

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
  currency_code      TEXT NOT NULL DEFAULT 'XOF',
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
  destination_amount     INTEGER,
  exchange_rate          REAL,
  exchange_rate_date     TEXT,
  exchange_rate_provider TEXT,
  note                   TEXT,
  merchant               TEXT,
  transaction_date       INTEGER NOT NULL,
  created_at             INTEGER NOT NULL
);

CREATE INDEX idx_transactions_account ON transactions (account_id);
CREATE INDEX idx_transactions_destination ON transactions (destination_account_id);
CREATE INDEX idx_transactions_date ON transactions (transaction_date);

CREATE TABLE transaction_splits (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  category_id    INTEGER NOT NULL REFERENCES categories(id),
  amount         INTEGER NOT NULL CHECK (amount > 0),
  created_at     INTEGER NOT NULL
);

CREATE INDEX idx_transaction_splits_transaction ON transaction_splits (transaction_id);
CREATE INDEX idx_transaction_splits_category ON transaction_splits (category_id);

CREATE TABLE people (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX ux_people_name ON people (name COLLATE NOCASE);

CREATE TABLE reimbursements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  person_id      INTEGER NOT NULL REFERENCES people(id),
  direction      TEXT NOT NULL CHECK (direction IN ('owed_to_me', 'i_owe')),
  amount         INTEGER NOT NULL CHECK (amount > 0),
  note           TEXT,
  created_at     INTEGER NOT NULL
);

CREATE INDEX idx_reimbursements_transaction ON reimbursements (transaction_id);
CREATE INDEX idx_reimbursements_person ON reimbursements (person_id);

CREATE TABLE reimbursement_settlements (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  reimbursement_id         INTEGER NOT NULL REFERENCES reimbursements(id) ON DELETE CASCADE,
  settlement_transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  amount                   INTEGER NOT NULL CHECK (amount > 0),
  created_at               INTEGER NOT NULL,
  UNIQUE (reimbursement_id, settlement_transaction_id)
);

CREATE INDEX idx_reimbursement_settlements_reimbursement
  ON reimbursement_settlements (reimbursement_id);
CREATE INDEX idx_reimbursement_settlements_transaction
  ON reimbursement_settlements (settlement_transaction_id);

CREATE TABLE tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX ux_tags_name ON tags (name COLLATE NOCASE);

CREATE TABLE transaction_tags (
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id         INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at     INTEGER NOT NULL,
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE INDEX idx_transaction_tags_tag ON transaction_tags (tag_id);

CREATE TABLE transaction_attachments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  original_name  TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  size           INTEGER NOT NULL CHECK (size >= 0),
  created_at     INTEGER NOT NULL
);

CREATE INDEX idx_transaction_attachments_transaction
  ON transaction_attachments (transaction_id);

CREATE TABLE import_batches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL UNIQUE,
  source_name TEXT,
  row_count   INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

ALTER TABLE transactions ADD COLUMN import_batch_id INTEGER REFERENCES import_batches(id);
ALTER TABLE transactions ADD COLUMN import_row_number INTEGER;
ALTER TABLE transactions ADD COLUMN import_fingerprint TEXT;

CREATE UNIQUE INDEX ux_transactions_import_fingerprint
  ON transactions (import_fingerprint)
  WHERE import_fingerprint IS NOT NULL;

CREATE TABLE budgets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  currency_code TEXT NOT NULL DEFAULT 'XOF',
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
  description   TEXT,
  image_uri     TEXT,
  link_url      TEXT,
  target_amount INTEGER NOT NULL CHECK (target_amount > 0),
  currency_code TEXT NOT NULL DEFAULT 'XOF',
  target_date   INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at    INTEGER NOT NULL
);

CREATE TABLE goal_reservations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id            INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  source_account_id  INTEGER NOT NULL REFERENCES accounts(id),
  amount             INTEGER NOT NULL CHECK (amount > 0),
  reference_amount   INTEGER NOT NULL DEFAULT 0,
  reference_currency TEXT NOT NULL DEFAULT 'XOF',
  exchange_rate      REAL NOT NULL DEFAULT 1,
  exchange_rate_date TEXT,
  exchange_rate_provider TEXT,
  note               TEXT,
  reservation_date   INTEGER NOT NULL,
  created_at         INTEGER NOT NULL,
  released_at        INTEGER
);

CREATE INDEX idx_goal_reservations_goal ON goal_reservations (goal_id);
CREATE INDEX idx_goal_reservations_source ON goal_reservations (source_account_id);

CREATE TABLE currencies (
  iso_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT
);

CREATE TABLE fx_rates (
  base_code TEXT NOT NULL,
  quote_code TEXT NOT NULL,
  rate REAL NOT NULL CHECK (rate > 0),
  rate_date TEXT NOT NULL,
  provider TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (base_code, quote_code)
);

CREATE TABLE app_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL,
  level      TEXT NOT NULL,
  context    TEXT NOT NULL,
  message    TEXT NOT NULL,
  session_id TEXT,
  error      TEXT,
  data       TEXT
);

CREATE INDEX idx_app_logs_ts ON app_logs (ts DESC);
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

const SEED_CATEGORY_ICONS: Record<string, string> = {
  Salaire: "banknote-arrow-up",
  "Virement reçu": "banknote",
  Cadeau: "gift",
  Remboursement: "rotate-ccw",
  Nourriture: "utensils",
  Transport: "car-front",
  Logement: "house",
  Factures: "receipt-text",
  Santé: "heart-pulse",
  Éducation: "graduation-cap",
  Loisirs: "gamepad-2",
  Shopping: "shopping-bag",
};

export const MIGRATION_V2 = `
  ALTER TABLE accounts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE accounts ADD COLUMN exclude_from_total INTEGER NOT NULL DEFAULT 0;
`;

export const MIGRATION_V3 = `
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
`;

export const MIGRATION_V4 = `
  CREATE TABLE savings_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    percent     INTEGER NOT NULL CHECK (percent > 0 AND percent <= 100),
    created_at  INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX ux_savings_rules_category ON savings_rules (category_id) WHERE category_id IS NOT NULL;
`;

export const MIGRATION_V5 = `
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

export const MIGRATION_V6 = `
  ALTER TABLE categories ADD COLUMN icon TEXT;
  UPDATE categories SET icon = 'tag' WHERE type IN ('income', 'expense');
`;

export const MIGRATION_V7 = `
  ALTER TABLE accounts ADD COLUMN description TEXT;
`;

export const MIGRATION_V8 = `
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
`;

export const MIGRATION_V9 = `
  ALTER TABLE accounts ADD COLUMN deleted_at INTEGER;
`;

export const MIGRATION_V10 = `
  ALTER TABLE savings_rules ADD COLUMN start_date INTEGER;
`;

export const MIGRATION_V11 = `
  ALTER TABLE savings_rules
    ADD COLUMN subtract_from_available INTEGER NOT NULL DEFAULT 0;
`;

export const MIGRATION_V12 = `
  ALTER TABLE accounts ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'XOF';
  ALTER TABLE transactions ADD COLUMN destination_amount INTEGER;
  ALTER TABLE transactions ADD COLUMN exchange_rate REAL;
  ALTER TABLE transactions ADD COLUMN exchange_rate_date TEXT;
  ALTER TABLE transactions ADD COLUMN exchange_rate_provider TEXT;
  ALTER TABLE budgets ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'XOF';
  ALTER TABLE goals ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'XOF';
  ALTER TABLE goal_reservations ADD COLUMN reference_amount INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE goal_reservations ADD COLUMN reference_currency TEXT NOT NULL DEFAULT 'XOF';
  ALTER TABLE goal_reservations ADD COLUMN exchange_rate REAL NOT NULL DEFAULT 1;
  ALTER TABLE goal_reservations ADD COLUMN exchange_rate_date TEXT;
  ALTER TABLE goal_reservations ADD COLUMN exchange_rate_provider TEXT;

  CREATE TABLE IF NOT EXISTS currencies (
    iso_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT
  );

  CREATE TABLE IF NOT EXISTS fx_rates (
    base_code TEXT NOT NULL,
    quote_code TEXT NOT NULL,
    rate REAL NOT NULL CHECK (rate > 0),
    rate_date TEXT NOT NULL,
    provider TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (base_code, quote_code)
  );

  UPDATE transactions
  SET destination_amount = amount,
      exchange_rate = 1,
      exchange_rate_date = date(transaction_date / 1000, 'unixepoch'),
      exchange_rate_provider = 'migration'
  WHERE type = 'transfer';

  UPDATE goal_reservations
  SET reference_amount = amount,
      reference_currency = 'XOF',
      exchange_rate = 1,
      exchange_rate_date = date(reservation_date / 1000, 'unixepoch'),
      exchange_rate_provider = 'migration'
  WHERE reference_amount = 0;
`;

export const MIGRATION_V13 = `
  CREATE TABLE IF NOT EXISTS app_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         TEXT NOT NULL,
    level      TEXT NOT NULL,
    context    TEXT NOT NULL,
    message    TEXT NOT NULL,
    session_id TEXT,
    error      TEXT,
    data       TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_app_logs_ts ON app_logs (ts DESC);
`;

export const MIGRATION_V14 = `
  ALTER TABLE goals ADD COLUMN description TEXT;
  ALTER TABLE goals ADD COLUMN image_uri TEXT;
  ALTER TABLE goals ADD COLUMN link_url TEXT;
`;

export const MIGRATION_V15 = `
  UPDATE categories
  SET icon = CASE name
    WHEN 'Salaire' THEN 'banknote-arrow-up'
    WHEN 'Virement reçu' THEN 'banknote'
    WHEN 'Cadeau' THEN 'gift'
    WHEN 'Remboursement' THEN 'rotate-ccw'
    WHEN 'Nourriture' THEN 'utensils'
    WHEN 'Transport' THEN 'car-front'
    WHEN 'Logement' THEN 'house'
    WHEN 'Factures' THEN 'receipt-text'
    WHEN 'Santé' THEN 'heart-pulse'
    WHEN 'Éducation' THEN 'graduation-cap'
    WHEN 'Loisirs' THEN 'gamepad-2'
    WHEN 'Shopping' THEN 'shopping-bag'
    ELSE icon
  END
  WHERE is_seed = 1 AND type IN ('income', 'expense') AND icon = 'tag';
`;

export const MIGRATION_V16 = `
  CREATE TABLE transaction_splits (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    category_id    INTEGER NOT NULL REFERENCES categories(id),
    amount         INTEGER NOT NULL CHECK (amount > 0),
    created_at     INTEGER NOT NULL
  );

  CREATE INDEX idx_transaction_splits_transaction ON transaction_splits (transaction_id);
  CREATE INDEX idx_transaction_splits_category ON transaction_splits (category_id);

  CREATE TABLE people (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX ux_people_name ON people (name COLLATE NOCASE);

  CREATE TABLE reimbursements (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    person_id      INTEGER NOT NULL REFERENCES people(id),
    direction      TEXT NOT NULL CHECK (direction IN ('owed_to_me', 'i_owe')),
    amount         INTEGER NOT NULL CHECK (amount > 0),
    note           TEXT,
    created_at     INTEGER NOT NULL
  );

  CREATE INDEX idx_reimbursements_transaction ON reimbursements (transaction_id);
  CREATE INDEX idx_reimbursements_person ON reimbursements (person_id);

  CREATE TABLE reimbursement_settlements (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    reimbursement_id          INTEGER NOT NULL REFERENCES reimbursements(id) ON DELETE CASCADE,
    settlement_transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    amount                    INTEGER NOT NULL CHECK (amount > 0),
    created_at                INTEGER NOT NULL,
    UNIQUE (reimbursement_id, settlement_transaction_id)
  );

  CREATE INDEX idx_reimbursement_settlements_reimbursement
    ON reimbursement_settlements (reimbursement_id);
  CREATE INDEX idx_reimbursement_settlements_transaction
    ON reimbursement_settlements (settlement_transaction_id);
`;

export const MIGRATION_V17 = `
  ALTER TABLE transactions ADD COLUMN merchant TEXT;

  CREATE TABLE tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX ux_tags_name ON tags (name COLLATE NOCASE);

  CREATE TABLE transaction_tags (
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id         INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at     INTEGER NOT NULL,
    PRIMARY KEY (transaction_id, tag_id)
  );

  CREATE INDEX idx_transaction_tags_tag ON transaction_tags (tag_id);

  CREATE TABLE transaction_attachments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    original_name  TEXT NOT NULL,
    mime_type      TEXT NOT NULL,
    storage_path   TEXT NOT NULL,
    size           INTEGER NOT NULL CHECK (size >= 0),
    created_at     INTEGER NOT NULL
  );

  CREATE INDEX idx_transaction_attachments_transaction
    ON transaction_attachments (transaction_id);
`;

export const MIGRATION_V18 = `
  CREATE TABLE import_batches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT NOT NULL UNIQUE,
    source_name TEXT,
    row_count   INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
  );

  ALTER TABLE transactions ADD COLUMN import_batch_id INTEGER REFERENCES import_batches(id);
  ALTER TABLE transactions ADD COLUMN import_row_number INTEGER;
  ALTER TABLE transactions ADD COLUMN import_fingerprint TEXT;

  CREATE UNIQUE INDEX ux_transactions_import_fingerprint
    ON transactions (import_fingerprint)
    WHERE import_fingerprint IS NOT NULL;
`;

export async function seedCategories(db: SQLiteDatabase): Promise<void> {
  for (const [type, names] of Object.entries(SEED_CATEGORIES)) {
    for (const name of names) {
      await db.runAsync(
        "INSERT INTO categories (type, name, is_seed, icon) VALUES (?, ?, 1, ?)",
        type,
        name,
        type === "account" ? null : SEED_CATEGORY_ICONS[name] ?? "tag",
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
      await db.execAsync(MIGRATION_V2);
    }
    if (currentDbVersion <= 2) {
      await db.execAsync(MIGRATION_V3);
    }
    if (currentDbVersion <= 3) {
      await db.execAsync(MIGRATION_V4);
    }
    if (currentDbVersion <= 4) {
      await db.execAsync(MIGRATION_V5);
    }
    if (currentDbVersion <= 5) {
      await db.execAsync(MIGRATION_V6);
    }
    if (currentDbVersion <= 6) {
      await db.execAsync(MIGRATION_V7);
    }
    if (currentDbVersion <= 7) {
      await db.execAsync(MIGRATION_V8);
    }
    if (currentDbVersion <= 8) {
      await db.execAsync(MIGRATION_V9);
    }
    if (currentDbVersion <= 9) {
      await db.execAsync(MIGRATION_V10);
    }
    if (currentDbVersion <= 10) {
      await db.execAsync(MIGRATION_V11);
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
    if (currentDbVersion <= 11) {
      await db.execAsync(MIGRATION_V12);
    }
    if (currentDbVersion <= 12) {
      await db.execAsync(MIGRATION_V13);
    }
    if (currentDbVersion <= 13) {
      await db.execAsync(MIGRATION_V14);
    }
    if (currentDbVersion <= 14) {
      await db.execAsync(MIGRATION_V15);
    }
    if (currentDbVersion <= 15) {
      await db.execAsync(MIGRATION_V16);
    }
    if (currentDbVersion <= 16) {
      await db.execAsync(MIGRATION_V17);
    }
    if (currentDbVersion <= 17) {
      await db.execAsync(MIGRATION_V18);
    }
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
