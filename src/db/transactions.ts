import type { SQLiteDatabase } from "expo-sqlite";
import { normalizeCategoryIcon } from "@/constants/category-icons";
import type {
  Transaction,
  TransactionAmountRow,
  TransactionInput,
  TransactionSearchCriteria,
  TransactionDetail,
  TransactionType,
} from "../types";
import {
  createJournalTransaction,
  deleteJournalTransaction,
  getJournalRelations,
  updateJournalTransaction,
} from "./journal";

interface TransactionRow {
  id: number;
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  accountId: number;
  accountName: string;
  accountCurrencyCode: string;
  destinationAccountId: number | null;
  destinationAccountName: string | null;
  destinationCurrencyCode: string | null;
  fee: number | null;
  destinationAmount: number | null;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  exchangeRateProvider: string | null;
  note: string | null;
  merchant: string | null;
  transactionDate: number;
  createdAt: number;
}

const SELECT_FIELDS = `
  t.id, t.type, t.amount,
  t.category_id AS categoryId,
  c.name AS categoryName,
  c.icon AS categoryIcon,
  t.account_id AS accountId,
  a.name AS accountName,
  a.currency_code AS accountCurrencyCode,
  t.destination_account_id AS destinationAccountId,
  da.name AS destinationAccountName,
  da.currency_code AS destinationCurrencyCode,
  t.fee,
  t.destination_amount AS destinationAmount,
  t.exchange_rate AS exchangeRate,
  t.exchange_rate_date AS exchangeRateDate,
  t.exchange_rate_provider AS exchangeRateProvider,
  t.note,
  t.merchant,
  t.transaction_date AS transactionDate,
  t.created_at AS createdAt
`;

const FROM_JOINS = `
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id AND a.deleted_at IS NULL
  LEFT JOIN accounts da ON da.id = t.destination_account_id AND da.deleted_at IS NULL
  LEFT JOIN categories c ON c.id = t.category_id
`;

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryIcon: row.categoryName ? normalizeCategoryIcon(row.categoryIcon) : null,
    accountId: row.accountId,
    accountName: row.accountName,
    accountCurrencyCode: row.accountCurrencyCode,
    destinationAccountId: row.destinationAccountId,
    destinationAccountName: row.destinationAccountName,
    destinationCurrencyCode: row.destinationCurrencyCode,
    fee: row.fee,
    destinationAmount:
      row.destinationAmount ?? (row.type === "transfer" ? row.amount : null),
    exchangeRate: row.exchangeRate,
    exchangeRateDate: row.exchangeRateDate,
    exchangeRateProvider: row.exchangeRateProvider,
    note: row.note,
    merchant: row.merchant,
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
      if (input.categoryId == null && (input.allocations?.length ?? 0) === 0) {
        throw new Error("Une catégorie est requise pour ce type de transaction.");
      }
      return {
        ...input,
        destinationAccountId: null,
        fee: null,
        destinationAmount: null,
        exchangeRate: null,
        exchangeRateDate: null,
        exchangeRateProvider: null,
        note: note || null,
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
        destinationAmount: input.destinationAmount ?? null,
        exchangeRate: input.exchangeRate ?? null,
        exchangeRateDate: input.exchangeRateDate ?? null,
        exchangeRateProvider: input.exchangeRateProvider ?? null,
        note: note || null,
        transactionDate: input.transactionDate,
        allocations: input.allocations,
        reimbursements: input.reimbursements,
      };
  }
}

async function normalizeTransfer(
  db: SQLiteDatabase,
  input: TransactionInput,
): Promise<TransactionInput> {
  if (input.type !== "transfer") return input;
  const accounts = await db.getAllAsync<{ id: number; currencyCode: string }>(
    "SELECT id, currency_code AS currencyCode FROM accounts WHERE id IN (?, ?)",
    input.accountId,
    input.destinationAccountId!,
  );
  const source = accounts.find((account) => account.id === input.accountId);
  const destination = accounts.find(
    (account) => account.id === input.destinationAccountId,
  );
  if (!source || !destination) {
    throw new Error("Le compte de transfert est introuvable.");
  }
  const sameCurrency = source.currencyCode === destination.currencyCode;
  const destinationAmount =
    input.destinationAmount ?? (sameCurrency ? input.amount : null);
  if (
    destinationAmount == null ||
    !Number.isInteger(destinationAmount) ||
    destinationAmount <= 0
  ) {
    throw new Error(
      "Le montant crédité est requis pour un transfert multidevise.",
    );
  }
  const exchangeRate = input.exchangeRate ?? (sameCurrency ? 1 : null);
  if (exchangeRate == null || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new Error("Le taux de change est requis pour un transfert multidevise.");
  }
  return {
    ...input,
    destinationAmount,
    exchangeRate,
    exchangeRateDate:
      input.exchangeRateDate ?? new Date().toISOString().slice(0, 10),
    exchangeRateProvider:
      input.exchangeRateProvider ?? (sameCurrency ? "same currency" : "manual"),
  };
}

export interface TransactionFilter {
  accountId?: number | null;
  accountIds?: readonly number[] | null;
  types?: readonly TransactionType[] | null;
  categoryIds?: readonly number[] | null;
  tagIds?: readonly number[] | null;
  merchant?: string | null;
  startMs?: number | null;
  endMs?: number | null;
  order?: "asc" | "desc";
  limit?: number | null;
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
  if (filter.accountIds != null) {
    if (filter.accountIds.length === 0) {
      conditions.push("0 = 1");
    } else {
      const placeholders = filter.accountIds.map(() => "?").join(", ");
      conditions.push(
        `(t.account_id IN (${placeholders}) OR t.destination_account_id IN (${placeholders}))`,
      );
      params.push(...filter.accountIds, ...filter.accountIds);
    }
  }
  if (filter.types != null) {
    if (filter.types.length === 0) {
      conditions.push("0 = 1");
    } else {
      const placeholders = filter.types.map(() => "?").join(", ");
      conditions.push(`t.type IN (${placeholders})`);
      params.push(...filter.types);
    }
  }
  if (filter.categoryIds != null) {
    if (filter.categoryIds.length === 0) {
      conditions.push("0 = 1");
    } else {
      const placeholders = filter.categoryIds.map(() => "?").join(", ");
      conditions.push(`t.category_id IN (${placeholders})`);
      params.push(...filter.categoryIds);
    }
  }
  if (filter.tagIds != null) {
    if (filter.tagIds.length === 0) {
      conditions.push("0 = 1");
    } else {
      const placeholders = filter.tagIds.map(() => "?").join(", ");
      conditions.push(
        `EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id = t.id AND tt.tag_id IN (${placeholders}))`,
      );
      params.push(...filter.tagIds);
    }
  }
  if (filter.merchant?.trim()) {
    conditions.push("t.merchant LIKE ? ESCAPE '\\'");
    params.push(`%${filter.merchant.trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`);
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
  if (
    filter.limit != null &&
    (!Number.isInteger(filter.limit) || filter.limit <= 0)
  ) {
    throw new Error("La limite de transactions doit être un entier positif.");
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter.limit != null ? "LIMIT ?" : "";
  if (filter.limit != null) params.push(filter.limit);

  return db
    .getAllAsync<TransactionRow>(
      `SELECT ${SELECT_FIELDS}
       ${FROM_JOINS}
       ${where}
       ORDER BY t.transaction_date ${order}, t.created_at ${order}, t.id ${order}
       ${limit}`,
      params,
    )
    .then((rows) => rows.map(mapTransaction));
}

export function listTransactionAmountRows(
  db: SQLiteDatabase,
  filter: Pick<TransactionFilter, "startMs" | "endMs"> = {},
): Promise<TransactionAmountRow[]> {
  const conditions: string[] = [];
  const params: number[] = [];
  if (filter.startMs != null) {
    conditions.push("t.transaction_date >= ?");
    params.push(filter.startMs);
  }
  if (filter.endMs != null) {
    conditions.push("t.transaction_date < ?");
    params.push(filter.endMs);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db.getAllAsync<TransactionAmountRow>(
    `SELECT t.type,
            t.amount,
            t.fee,
            a.currency_code AS accountCurrencyCode
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id AND a.deleted_at IS NULL
     ${where}`,
    params,
  );
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
       WHERE NOT EXISTS (
         SELECT 1 FROM accounts a1 WHERE a1.id = transactions.account_id AND a1.deleted_at IS NOT NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM accounts a2 WHERE a2.id = transactions.destination_account_id AND a2.deleted_at IS NOT NULL
       )
       ORDER BY year DESC`,
    )
    .then((rows) => rows.map((r) => r.year));
}

export function searchTransactionsByText(
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
          OR t.merchant LIKE ? ESCAPE '\\'
          OR c.name LIKE ? ESCAPE '\\'
          OR a.name LIKE ? ESCAPE '\\'
          OR da.name LIKE ? ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM transaction_tags stt JOIN tags st ON st.id = stt.tag_id
                     WHERE stt.transaction_id = t.id AND st.name LIKE ? ESCAPE '\\')
          OR CAST(t.amount AS TEXT) LIKE ? ESCAPE '\\'
       ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC
       LIMIT ?`,
      [pattern, pattern, pattern, pattern, pattern, pattern, pattern, limit],
    )
    .then((rows) => rows.map(mapTransaction));
}

export function searchTransactions(
  db: SQLiteDatabase,
  criteria: TransactionSearchCriteria,
  limit = 200,
): Promise<Transaction[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  const query = criteria.query.trim();

  if (query) {
    const pattern =
      "%" +
      query
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_") +
      "%";
    conditions.push(
      "(t.note LIKE ? ESCAPE '\\' OR t.merchant LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR " +
        "a.name LIKE ? ESCAPE '\\' OR da.name LIKE ? ESCAPE '\\' OR " +
        "EXISTS (SELECT 1 FROM transaction_tags stt JOIN tags st ON st.id = stt.tag_id " +
        "WHERE stt.transaction_id = t.id AND st.name LIKE ? ESCAPE '\\') OR " +
        "CAST(t.amount AS TEXT) LIKE ? ESCAPE '\\')",
    );
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  if (criteria.startDate != null) {
    conditions.push("t.transaction_date >= ?");
    params.push(criteria.startDate);
  }
  if (criteria.endDate != null) {
    const end = new Date(criteria.endDate);
    const exclusiveEnd = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate() + 1,
    ).getTime();
    conditions.push("t.transaction_date < ?");
    params.push(exclusiveEnd);
  }
  if (criteria.minAmount != null) {
    conditions.push("t.amount >= ?");
    params.push(criteria.minAmount);
  }
  if (criteria.maxAmount != null) {
    conditions.push("t.amount <= ?");
    params.push(criteria.maxAmount);
  }
  if (criteria.accountIds != null) {
    if (criteria.accountIds.length === 0) {
      conditions.push("0 = 1");
    } else {
      const placeholders = criteria.accountIds.map(() => "?").join(", ");
      conditions.push(
        "(t.account_id IN (" +
          placeholders +
          ") OR t.destination_account_id IN (" +
          placeholders +
          "))",
      );
      params.push(...criteria.accountIds, ...criteria.accountIds);
    }
  }
  if (criteria.types.length === 0) {
    conditions.push("0 = 1");
  } else if (criteria.types.length < 3) {
    const placeholders = criteria.types.map(() => "?").join(", ");
    conditions.push("t.type IN (" + placeholders + ")");
    params.push(...criteria.types);
  }
  if (criteria.categoryIds != null) {
    if (criteria.categoryIds.length === 0) {
      conditions.push("0 = 1");
    } else {
      const placeholders = criteria.categoryIds.map(() => "?").join(", ");
      conditions.push("t.category_id IN (" + placeholders + ")");
      params.push(...criteria.categoryIds);
    }
  }
  if (criteria.tagIds != null) {
    if (criteria.tagIds.length === 0) {
      conditions.push("0 = 1");
    } else {
      const placeholders = criteria.tagIds.map(() => "?").join(", ");
      conditions.push(
        `EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id = t.id AND tt.tag_id IN (${placeholders}))`,
      );
      params.push(...criteria.tagIds);
    }
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const safeLimit = Math.max(1, Math.floor(limit));
  const sql =
    "SELECT " +
    SELECT_FIELDS +
    "\n" +
    FROM_JOINS +
    "\n" +
    where +
    "\nORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC\nLIMIT ?";

  return db
    .getAllAsync<TransactionRow>(sql, [...params, safeLimit])
    .then((rows) => rows.map(mapTransaction));
}

export function listTransactionsByAccount(
  db: SQLiteDatabase,
  accountId: number,
): Promise<Transaction[]> {
  // Une opération future appartient au forecast, pas à l'historique du compte.
  return listTransactions(db, { accountId, endMs: Date.now(), order: "desc" });
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
  const valid = await normalizeTransfer(db, validateInput(input));
  return createJournalTransaction(db, valid);
}

export async function updateTransaction(
  db: SQLiteDatabase,
  id: number,
  input: TransactionInput,
): Promise<void> {
  const valid = await normalizeTransfer(db, validateInput(input));
  await updateJournalTransaction(db, id, valid);
}

export async function deleteTransaction(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await deleteJournalTransaction(db, id);
}

export async function getTransactionDetail(
  db: SQLiteDatabase,
  id: number,
): Promise<TransactionDetail | null> {
  const transaction = await getTransaction(db, id);
  if (!transaction) {
    return null;
  }
  const relations = await getJournalRelations(db, id);
  return { transaction, ...relations };
}
