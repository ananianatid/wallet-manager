import type { SQLiteDatabase } from "expo-sqlite";
import type { Account, AccountInput } from "../types";

interface AccountRow {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  createdAt: number;
  balance: number;
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
    createdAt: row.createdAt,
    balance: row.balance,
  };
}

export async function listAccounts(db: SQLiteDatabase): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT a.id, a.name,
            a.category_id AS categoryId,
            c.name AS categoryName,
            a.created_at AS createdAt,
            COALESCE((
              SELECT ${balanceSum("a.id")}
              FROM transactions t
              WHERE t.account_id = a.id OR t.destination_account_id = a.id
            ), 0) AS balance
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
            COALESCE((
              SELECT ${balanceSum("a.id")}
              FROM transactions t
              WHERE t.account_id = a.id OR t.destination_account_id = a.id
            ), 0) AS balance
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
  await db.runAsync("DELETE FROM accounts WHERE id = ?", id);
}
