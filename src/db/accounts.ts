import type { SQLiteDatabase } from "expo-sqlite";
import { ensureCategory } from "./categories";
import { createTransaction } from "./transactions";
import type { Account, AccountInput } from "../types";

interface AccountRow {
  id: number;
  name: string;
  groupId: number | null;
  groupName: string | null;
  hidden: number;
  excludeFromTotal: number;
  description: string | null;
  currencyCode: string;
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
              ELSE COALESCE(destination_amount, amount)
            END
    END
  )
`;

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    groupId: row.groupId,
    groupName: row.groupName,
    hidden: row.hidden !== 0,
    excludeFromTotal: row.excludeFromTotal !== 0,
    description: row.description,
    currencyCode: row.currencyCode,
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

const txAccountsActive = `
  AND (SELECT a2.deleted_at FROM accounts a2 WHERE a2.id = t.account_id) IS NULL
  AND (SELECT a2.deleted_at FROM accounts a2 WHERE a2.id = t.destination_account_id) IS NULL
`;

const accountSelect = (where: string): string => `
  SELECT a.id, a.name,
         a.group_id AS groupId,
         g.name AS groupName,
         a.created_at AS createdAt,
         a.hidden AS hidden,
         a.exclude_from_total AS excludeFromTotal,
         a.currency_code AS currencyCode,
         a.description AS description,
         ${reservedSum("a.id")} AS reservedAmount,
         COALESCE((
           SELECT ${balanceSum("a.id")}
           FROM transactions t
           WHERE (t.account_id = a.id OR t.destination_account_id = a.id)
           ${txAccountsActive}
         ), 0) AS balance,
         COALESCE((
           SELECT ${balanceSum("a.id")}
           FROM transactions t
           WHERE (t.account_id = a.id OR t.destination_account_id = a.id)
           ${txAccountsActive}
         ), 0) - ${reservedSum("a.id")} AS availableBalance
  FROM accounts a
  LEFT JOIN account_groups g ON g.id = a.group_id
  ${where}
`;

export async function listAccounts(db: SQLiteDatabase): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `${accountSelect("WHERE a.deleted_at IS NULL")} ORDER BY a.name`,
  );
  return rows.map(mapAccount);
}

export async function listDeletedAccounts(
  db: SQLiteDatabase,
): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `${accountSelect("WHERE a.deleted_at IS NOT NULL")} ORDER BY a.name`,
  );
  return rows.map(mapAccount);
}

export async function getAccount(
  db: SQLiteDatabase,
  id: number,
): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>(
    `${accountSelect("WHERE a.id = ? AND a.deleted_at IS NULL")}`,
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
     FROM transactions t
     WHERE (t.account_id = ? OR t.destination_account_id = ?)
     ${txAccountsActive}`,
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
       WHERE (t.account_id = a.id OR t.destination_account_id = a.id)
       ${txAccountsActive}
     ), 0) - COALESCE((
       SELECT SUM(gr.amount)
       FROM goal_reservations gr
       WHERE gr.source_account_id = a.id AND gr.released_at IS NULL
     ), 0) AS availableBalance
     FROM accounts a
     WHERE a.id = ? AND a.deleted_at IS NULL`,
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
  const categoryId = await ensureCategory(db, "account", "Compte courant");
  const result = await db.runAsync(
    "INSERT INTO accounts (name, category_id, group_id, currency_code, created_at) VALUES (?, ?, ?, ?, ?)",
    name,
    categoryId,
    input.groupId,
    input.currencyCode ?? "XOF",
    Date.now(),
  );
  return Number(result.lastInsertRowId);
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

export async function updateAccountDetails(
  db: SQLiteDatabase,
  id: number,
  details: { name: string; groupId: number | null; description: string | null },
): Promise<void> {
  const trimmed = details.name.trim();
  if (!trimmed) {
    throw new Error("Le nom du compte ne peut pas être vide.");
  }
  await db.runAsync(
    "UPDATE accounts SET name = ?, group_id = ?, description = ? WHERE id = ?",
    trimmed,
    details.groupId,
    details.description?.trim() ? details.description.trim() : null,
    id,
  );
}

export function planBalanceAdjustment(
  current: number,
  target: number,
): { type: "income" | "expense"; amount: number } | null {
  const delta = target - current;
  if (delta === 0) {
    return null;
  }
  return { type: delta > 0 ? "income" : "expense", amount: Math.abs(delta) };
}

export async function setAccountBalance(
  db: SQLiteDatabase,
  accountId: number,
  target: number,
  now: number = Date.now(),
): Promise<{ type: "income" | "expense"; amount: number; categoryId: number } | null> {
  const account = await getAccount(db, accountId);
  if (!account) {
    throw new Error("Compte introuvable.");
  }
  const adjustment = planBalanceAdjustment(account.balance, target);
  if (!adjustment) {
    return null;
  }
  const categoryId = await ensureCategory(db, adjustment.type, "Autre");
  await createTransaction(db, {
    type: adjustment.type,
    amount: adjustment.amount,
    categoryId,
    accountId,
    destinationAccountId: null,
    fee: null,
    note: "Équilibre",
    transactionDate: now,
  });
  return { ...adjustment, categoryId };
}

export async function deleteAccount(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  const activeReservations = await db.getFirstAsync<{ active: number }>(
    "SELECT EXISTS(SELECT 1 FROM goal_reservations WHERE source_account_id = ? AND released_at IS NULL) AS active",
    id,
  );
  if (activeReservations?.active) {
    throw new Error("Libérez d'abord les réservations de cet objectif.");
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE recurring_transactions SET is_active = 0 WHERE account_id = ? OR destination_account_id = ?",
      id,
      id,
    );
    await db.runAsync(
      "UPDATE accounts SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
      Date.now(),
      id,
    );
  });
}

export async function restoreAccount(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync(
    "UPDATE accounts SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL",
    id,
  );
}
