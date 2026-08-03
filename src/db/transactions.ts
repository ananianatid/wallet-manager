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

export function listTransactionsByMonth(
  db: SQLiteDatabase,
  year: number,
  month: number,
): Promise<Transaction[]> {
  const { start, end } = getMonthRange(year, month);
  return db
    .getAllAsync<TransactionRow>(
      `SELECT ${SELECT_FIELDS}
       ${FROM_JOINS}
       WHERE t.transaction_date >= ? AND t.transaction_date < ?
       ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC`,
      [start, end],
    )
    .then((rows) => rows.map(mapTransaction));
}

export function listTransactionsByAccount(
  db: SQLiteDatabase,
  accountId: number,
): Promise<Transaction[]> {
  return db
    .getAllAsync<TransactionRow>(
      `SELECT ${SELECT_FIELDS}
       ${FROM_JOINS}
       WHERE t.account_id = ? OR t.destination_account_id = ?
       ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC`,
      [accountId, accountId],
    )
    .then((rows) => rows.map(mapTransaction));
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
