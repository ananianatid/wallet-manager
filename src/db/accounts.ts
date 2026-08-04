import type { SQLiteDatabase } from "expo-sqlite";
import type { Account, AccountInput } from "../types";

interface AccountRow {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  hidden: number;
  excludeFromTotal: number;
  createdAt: number;
  balance: number;
  reservedAmount: number;
  availableBalance: number;
}

const balanceSum = (accountRef: string): string => `
  SUM(
    CASE
      WHEN type = 'income' THEN amount
      WHEN type = 'expense' THEN -amount
      WHEN type = 'transfer' THEN
        CASE
          WHEN account_id = ${accountRef} THEN -(amount + COALESCE(fee, 0))
          ELSE amount
        END
    END
  )
`;

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    hidden: row.hidden !== 0,
    excludeFromTotal: row.excludeFromTotal !== 0,
    createdAt: row.createdAt,
    balance: row.balance,
    reservedAmount: row.reservedAmount,
    availableBalance: row.availableBalance,
  };
}

const reservedSum = (accountRef: string): string => `
  COALESCE((
    SELECT SUM(gr.amount)
    FROM goal_reservations gr
    WHERE gr.source_account_id = ${accountRef}
      AND gr.released_at IS NULL
  ), 0)
`;

export async function listAccounts(db: SQLiteDatabase): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT a.id, a.name,
            a.category_id AS categoryId,
            c.name AS categoryName,
            a.created_at AS createdAt,
            a.hidden AS hidden,
            a.exclude_from_total AS excludeFromTotal,
            ${reservedSum("a.id")} AS reservedAmount,
            COALESCE((
              SELECT ${balanceSum("a.id")}
              FROM transactions t
              WHERE t.account_id = a.id OR t.destination_account_id = a.id
            ), 0) AS balance,
            COALESCE((
              SELECT ${balanceSum("a.id")}
              FROM transactions t
              WHERE t.account_id = a.id OR t.destination_account_id = a.id
            ), 0) - ${reservedSum("a.id")} AS availableBalance
     FROM accounts a
     JOIN categories c ON c.id = a.category_id
     ORDER BY a.name`,
  );
  return rows.map(mapAccount);
}

export async function getAccount(
  db: SQLiteDatabase,
  id: number,
): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>(
    `SELECT a.id, a.name,
            a.category_id AS categoryId,
            c.name AS categoryName,
            a.created_at AS createdAt,
            a.hidden AS hidden,
            a.exclude_from_total AS excludeFromTotal,
            ${reservedSum("a.id")} AS reservedAmount,
            COALESCE((
              SELECT ${balanceSum("a.id")}
              FROM transactions t
              WHERE t.account_id = a.id OR t.destination_account_id = a.id
            ), 0) AS balance,
            COALESCE((
              SELECT ${balanceSum("a.id")}
              FROM transactions t
              WHERE t.account_id = a.id OR t.destination_account_id = a.id
            ), 0) - ${reservedSum("a.id")} AS availableBalance
     FROM accounts a
     JOIN categories c ON c.id = a.category_id
     WHERE a.id = ?`,
    [id],
  );
  return row ? mapAccount(row) : null;
}

export async function getAccountBalance(
  db: SQLiteDatabase,
  id: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ balance: number }>(
    `SELECT COALESCE(${balanceSum("?")}, 0) AS balance
     FROM transactions
     WHERE account_id = ? OR destination_account_id = ?`,
    [id, id, id],
  );
  return row?.balance ?? 0;
}

export async function getAccountAvailableBalance(
  db: SQLiteDatabase,
  id: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ availableBalance: number }>(
    `SELECT COALESCE((
       SELECT ${balanceSum("a.id")}
       FROM transactions t
       WHERE t.account_id = a.id OR t.destination_account_id = a.id
     ), 0) - COALESCE((
       SELECT SUM(gr.amount)
       FROM goal_reservations gr
       WHERE gr.source_account_id = a.id AND gr.released_at IS NULL
     ), 0) AS availableBalance
     FROM accounts a
     WHERE a.id = ?`,
    id,
  );
  return row?.availableBalance ?? 0;
}

export async function createAccount(
  db: SQLiteDatabase,
  input: AccountInput,
): Promise<number> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom du compte ne peut pas être vide.");
  }
  const result = await db.runAsync(
    "INSERT INTO accounts (name, category_id, created_at) VALUES (?, ?, ?)",
    name,
    input.categoryId,
    Date.now(),
  );
  return Number(result.lastInsertRowId);
}

export async function renameAccount(
  db: SQLiteDatabase,
  id: number,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Le nom du compte ne peut pas être vide.");
  }
  await db.runAsync("UPDATE accounts SET name = ? WHERE id = ?", trimmed, id);
}

export async function updateAccountFlags(
  db: SQLiteDatabase,
  id: number,
  flags: { hidden?: boolean; excludeFromTotal?: boolean },
): Promise<void> {
  await db.runAsync(
    `UPDATE accounts
     SET hidden = COALESCE(?, hidden),
         exclude_from_total = COALESCE(?, exclude_from_total)
     WHERE id = ?`,
    flags.hidden == null ? null : flags.hidden ? 1 : 0,
    flags.excludeFromTotal == null ? null : flags.excludeFromTotal ? 1 : 0,
    id,
  );
}

export async function deleteAccount(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  const used = await db.getFirstAsync<{ used: number }>(
    "SELECT EXISTS(SELECT 1 FROM transactions WHERE account_id = ? OR destination_account_id = ?) AS used",
    id,
    id,
  );
  if (used?.used) {
    throw new Error(
      "Ce compte contient des transactions. Supprimez-les d'abord.",
    );
  }
  const reserved = await db.getFirstAsync<{ reserved: number }>(
    "SELECT EXISTS(SELECT 1 FROM goal_reservations WHERE source_account_id = ?) AS reserved",
    id,
  );
  if (reserved?.reserved) {
    throw new Error(
      "Ce compte contient des sommes réservées à des objectifs. Libérez-les d'abord.",
    );
  }
  await db.runAsync("DELETE FROM accounts WHERE id = ?", id);
}
