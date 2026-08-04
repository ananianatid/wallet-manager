import type { SQLiteDatabase } from "expo-sqlite";
import type { Transaction, TransactionInput, TransactionType } from "../types";

interface TransactionRow {
  id: number;
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  accountId: number;
  accountName: string;
  destinationAccountId: number | null;
  destinationAccountName: string | null;
  fee: number | null;
  note: string | null;
  transactionDate: number;
  createdAt: number;
}

const SELECT_FIELDS = `
  t.id, t.type, t.amount,
  t.category_id AS categoryId,
  c.name AS categoryName,
  t.account_id AS accountId,
  a.name AS accountName,
  t.destination_account_id AS destinationAccountId,
  da.name AS destinationAccountName,
  t.fee, t.note,
  t.transaction_date AS transactionDate,
  t.created_at AS createdAt
`;

const FROM_JOINS = `
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts da ON da.id = t.destination_account_id
  LEFT JOIN categories c ON c.id = t.category_id
`;

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    accountId: row.accountId,
    accountName: row.accountName,
    destinationAccountId: row.destinationAccountId,
    destinationAccountName: row.destinationAccountName,
    fee: row.fee,
    note: row.note,
    transactionDate: row.transactionDate,
    createdAt: row.createdAt,
  };
}

function getMonthRange(
  year: number,
  month: number,
): { start: number; end: number } {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  return { start, end };
}

function validateInput(input: TransactionInput): TransactionInput {
  const note = input.note?.trim();
  const fee = input.fee ?? null;

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Le montant doit être un entier strictement positif.");
  }
  if (!Number.isInteger(input.transactionDate)) {
    throw new Error("La date de transaction est invalide.");
  }

  switch (input.type) {
    case "income":
    case "expense":
      if (input.categoryId == null) {
        throw new Error("Une catégorie est requise pour ce type de transaction.");
      }
      return {
        type: input.type,
        amount: input.amount,
        categoryId: input.categoryId,
        accountId: input.accountId,
        destinationAccountId: null,
        fee: null,
        note: note || null,
        transactionDate: input.transactionDate,
      };
    case "transfer":
      if (input.destinationAccountId == null) {
        throw new Error("Un compte de destination est requis pour un transfert.");
      }
      if (input.destinationAccountId === input.accountId) {
        throw new Error("Le compte de destination doit différer du compte source.");
      }
      if (fee != null && (!Number.isInteger(fee) || fee <= 0)) {
        throw new Error("Les frais doivent être un entier strictement positif.");
      }
      return {
        type: input.type,
        amount: input.amount,
        categoryId: null,
        accountId: input.accountId,
        destinationAccountId: input.destinationAccountId,
        fee,
        note: note || null,
        transactionDate: input.transactionDate,
      };
  }
}

export interface TransactionFilter {
  accountId?: number | null;
  startMs?: number | null;
  endMs?: number | null;
  order?: "asc" | "desc";
}

export function listTransactions(
  db: SQLiteDatabase,
  filter: TransactionFilter = {},
): Promise<Transaction[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.accountId != null) {
    conditions.push("(t.account_id = ? OR t.destination_account_id = ?)");
    params.push(filter.accountId, filter.accountId);
  }
  if (filter.startMs != null) {
    conditions.push("t.transaction_date >= ?");
    params.push(filter.startMs);
  }
  if (filter.endMs != null) {
    conditions.push("t.transaction_date < ?");
    params.push(filter.endMs);
  }

  const order = filter.order === "asc" ? "ASC" : "DESC";
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return db
    .getAllAsync<TransactionRow>(
      `SELECT ${SELECT_FIELDS}
       ${FROM_JOINS}
       ${where}
       ORDER BY t.transaction_date ${order}, t.created_at ${order}, t.id ${order}`,
      params,
    )
    .then((rows) => rows.map(mapTransaction));
}

export function listTransactionsByMonth(
  db: SQLiteDatabase,
  year: number,
  month: number,
): Promise<Transaction[]> {
  const { start, end } = getMonthRange(year, month);
  return listTransactions(db, { startMs: start, endMs: end, order: "asc" });
}

export function listTransactionsByRange(
  db: SQLiteDatabase,
  startMs: number,
  endMs: number,
): Promise<Transaction[]> {
  return listTransactions(db, { startMs, endMs, order: "asc" });
}

export function listTransactionYears(db: SQLiteDatabase): Promise<number[]> {
  return db
    .getAllAsync<{ year: number }>(
      `SELECT DISTINCT CAST(
         strftime('%Y', transaction_date / 1000, 'unixepoch', 'localtime') AS INTEGER
       ) AS year
       FROM transactions
       ORDER BY year DESC`,
    )
    .then((rows) => rows.map((r) => r.year));
}

export function searchTransactions(
  db: SQLiteDatabase,
  query: string,
  limit = 200,
): Promise<Transaction[]> {
  const pattern = `%${query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  return db
    .getAllAsync<TransactionRow>(
      `SELECT ${SELECT_FIELDS}
       ${FROM_JOINS}
       WHERE t.note LIKE ? ESCAPE '\\'
          OR c.name LIKE ? ESCAPE '\\'
          OR a.name LIKE ? ESCAPE '\\'
          OR da.name LIKE ? ESCAPE '\\'
          OR CAST(t.amount AS TEXT) LIKE ? ESCAPE '\\'
       ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC
       LIMIT ?`,
      [pattern, pattern, pattern, pattern, pattern, limit],
    )
    .then((rows) => rows.map(mapTransaction));
}

export function listTransactionsByAccount(
  db: SQLiteDatabase,
  accountId: number,
): Promise<Transaction[]> {
  return listTransactions(db, { accountId, order: "desc" });
}

export async function getTransaction(
  db: SQLiteDatabase,
  id: number,
): Promise<Transaction | null> {
  const row = await db.getFirstAsync<TransactionRow>(
    `SELECT ${SELECT_FIELDS}
     ${FROM_JOINS}
     WHERE t.id = ?`,
    id,
  );
  return row ? mapTransaction(row) : null;
}

export async function createTransaction(
  db: SQLiteDatabase,
  input: TransactionInput,
): Promise<number> {
  const valid = validateInput(input);
  const result = await db.runAsync(
    `INSERT INTO transactions
       (type, amount, category_id, account_id, destination_account_id, fee, note, transaction_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    valid.type,
    valid.amount,
    valid.categoryId,
    valid.accountId,
    valid.destinationAccountId,
    valid.fee,
    valid.note,
    valid.transactionDate,
    Date.now(),
  );
  return Number(result.lastInsertRowId);
}

export async function updateTransaction(
  db: SQLiteDatabase,
  id: number,
  input: TransactionInput,
): Promise<void> {
  const valid = validateInput(input);
  await db.runAsync(
    `UPDATE transactions SET
       type = ?,
       amount = ?,
       category_id = ?,
       account_id = ?,
       destination_account_id = ?,
       fee = ?,
       note = ?,
       transaction_date = ?
     WHERE id = ?`,
    valid.type,
    valid.amount,
    valid.categoryId,
    valid.accountId,
    valid.destinationAccountId,
    valid.fee,
    valid.note,
    valid.transactionDate,
    id,
  );
}

export async function deleteTransaction(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync("DELETE FROM transactions WHERE id = ?", id);
}
