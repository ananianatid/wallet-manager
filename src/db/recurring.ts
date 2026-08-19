import type { SQLiteDatabase } from "expo-sqlite";
import { normalizeCategoryIcon } from "@/constants/category-icons";
import type {
  Frequency,
  RecurringTransaction,
  RecurringTransactionInput,
  TransactionType,
} from "../types";
import { convertMinorAmount } from "@/currency/currencies";
import { getRateForPair } from "@/currency/service";

interface RecurringRow {
  id: number;
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  accountId: number;
  accountName: string;
  destinationAccountId: number | null;
  destinationAccountName: string | null;
  fee: number | null;
  sourceCurrencyCode: string;
  destinationCurrencyCode: string | null;
  note: string | null;
  frequency: Frequency;
  interval: number;
  startDate: number;
  nextDate: number;
  endDate: number | null;
  isActive: number;
  createdAt: number;
}

const SELECT_FIELDS = `
  r.id, r.type, r.amount,
  r.category_id AS categoryId,
  c.name AS categoryName,
  c.icon AS categoryIcon,
  r.account_id AS accountId,
  a.name AS accountName,
  r.destination_account_id AS destinationAccountId,
  da.name AS destinationAccountName,
  r.fee, r.note,
  a.currency_code AS sourceCurrencyCode,
  da.currency_code AS destinationCurrencyCode,
  r.frequency, r.interval,
  r.start_date AS startDate,
  r.next_date AS nextDate,
  r.end_date AS endDate,
  r.is_active AS isActive,
  r.created_at AS createdAt
`;

const FROM_JOINS = `
  FROM recurring_transactions r
  JOIN accounts a ON a.id = r.account_id AND a.deleted_at IS NULL
  LEFT JOIN accounts da ON da.id = r.destination_account_id AND da.deleted_at IS NULL
  LEFT JOIN categories c ON c.id = r.category_id
`;

function mapRecurring(row: RecurringRow): RecurringTransaction {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryIcon: row.categoryName ? normalizeCategoryIcon(row.categoryIcon) : null,
    accountId: row.accountId,
    accountName: row.accountName,
    destinationAccountId: row.destinationAccountId,
    destinationAccountName: row.destinationAccountName,
    fee: row.fee,
    sourceCurrencyCode: row.sourceCurrencyCode,
    destinationCurrencyCode: row.destinationCurrencyCode,
    note: row.note,
    frequency: row.frequency,
    interval: row.interval,
    startDate: row.startDate,
    nextDate: row.nextDate,
    endDate: row.endDate,
    isActive: row.isActive !== 0,
    createdAt: row.createdAt,
  };
}

export function validateRecurringInput(
  input: RecurringTransactionInput,
): RecurringTransactionInput {
  const note = input.note ? input.note.trim() || null : null;
  const fee = input.fee ?? null;

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Le montant doit être un entier strictement positif.");
  }
  if (!Number.isInteger(input.interval) || input.interval <= 0) {
    throw new Error("L'intervalle doit être un entier positif.");
  }
  if (!Number.isInteger(input.startDate) || !Number.isInteger(input.nextDate)) {
    throw new Error("Les dates sont invalides.");
  }
  if (input.endDate != null && input.endDate < input.startDate) {
    throw new Error("La date de fin doit être après la date de début.");
  }

  switch (input.type) {
    case "income":
    case "expense":
      if (input.categoryId == null) {
        throw new Error("Une catégorie est requise pour ce type de transaction.");
      }
      return {
        ...input,
        categoryId: input.categoryId,
        destinationAccountId: null,
        fee: null,
        note,
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
      return { ...input, categoryId: null, fee, note };
  }
}

const advanceDate = (nextMs: number, frequency: Frequency, interval: number): number => {
  const date = new Date(nextMs);
  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + interval);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7 * interval);
      break;
    case "monthly": {
      const targetMonth = date.getMonth();
      date.setMonth(date.getMonth() + interval);
      if (date.getMonth() !== (targetMonth + interval) % 12) {
        date.setDate(0);
      }
      break;
    }
    case "yearly": {
      const targetMonth = date.getMonth();
      date.setFullYear(date.getFullYear() + interval);
      if (date.getMonth() !== targetMonth) {
        date.setDate(0);
      }
      break;
    }
  }
  return date.getTime();
};

export function listRecurring(
  db: SQLiteDatabase,
): Promise<RecurringTransaction[]> {
  return db
    .getAllAsync<RecurringRow>(
      `SELECT ${SELECT_FIELDS}
       ${FROM_JOINS}
       ORDER BY r.is_active DESC, r.next_date ASC`,
    )
    .then((rows) => rows.map(mapRecurring));
}

export async function createRecurring(
  db: SQLiteDatabase,
  input: RecurringTransactionInput,
): Promise<number> {
  const valid = validateRecurringInput(input);
  const result = await db.runAsync(
    `INSERT INTO recurring_transactions
       (type, amount, category_id, account_id, destination_account_id, fee, note,
        frequency, interval, start_date, next_date, end_date, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    valid.type,
    valid.amount,
    valid.categoryId,
    valid.accountId,
    valid.destinationAccountId,
    valid.fee,
    valid.note,
    valid.frequency,
    valid.interval,
    valid.startDate,
    valid.nextDate,
    valid.endDate,
    valid.isActive ? 1 : 0,
    Date.now(),
  );
  return Number(result.lastInsertRowId);
}

export async function updateRecurring(
  db: SQLiteDatabase,
  id: number,
  input: RecurringTransactionInput,
): Promise<void> {
  const valid = validateRecurringInput(input);
  await db.runAsync(
    `UPDATE recurring_transactions SET
       type = ?, amount = ?, category_id = ?, account_id = ?, destination_account_id = ?,
       fee = ?, note = ?, frequency = ?, interval = ?, start_date = ?, next_date = ?,
       end_date = ?, is_active = ?
     WHERE id = ?`,
    valid.type,
    valid.amount,
    valid.categoryId,
    valid.accountId,
    valid.destinationAccountId,
    valid.fee,
    valid.note,
    valid.frequency,
    valid.interval,
    valid.startDate,
    valid.nextDate,
    valid.endDate,
    valid.isActive ? 1 : 0,
    id,
  );
}

export async function deleteRecurring(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync("DELETE FROM recurring_transactions WHERE id = ?", id);
}

export async function getRecurring(
  db: SQLiteDatabase,
  id: number,
): Promise<RecurringTransaction | null> {
  const row = await db.getFirstAsync<RecurringRow>(
    `SELECT ${SELECT_FIELDS}
     ${FROM_JOINS}
     WHERE r.id = ?`,
    id,
  );
  return row ? mapRecurring(row) : null;
}

export const MAX_OCCURRENCES_PER_SERIES = 24;

export async function applyDueRecurring(
  db: SQLiteDatabase,
  now = Date.now(),
  maxPerSeries = MAX_OCCURRENCES_PER_SERIES,
): Promise<number> {
  const due = await db.getAllAsync<RecurringRow>(
    `SELECT ${SELECT_FIELDS}
     ${FROM_JOINS}
     WHERE r.is_active = 1
       AND r.next_date <= ?
       AND (r.end_date IS NULL OR r.next_date <= r.end_date)
     ORDER BY r.next_date ASC`,
    now,
  );

  // Resolve exchange rates before opening the write transaction. A rate lookup
  // may refresh its cache, which has its own transaction and must not be nested
  // inside the transaction that materializes recurring rows.
  const resolvedRates = new Map<
    number,
    NonNullable<Awaited<ReturnType<typeof getRateForPair>>>
  >();
  for (const row of due) {
    const sameCurrency =
      row.destinationCurrencyCode == null ||
      row.sourceCurrencyCode === row.destinationCurrencyCode;
    if (sameCurrency) {
      continue;
    }
    const rate = await getRateForPair(
      db,
      row.sourceCurrencyCode,
      row.destinationCurrencyCode!,
    );
    if (!rate) {
      throw new Error(
        `Taux indisponible pour ${row.sourceCurrencyCode}/${row.destinationCurrencyCode}.`,
      );
    }
    resolvedRates.set(row.id, rate);
  }

  if (due.length === 0) {
    return 0;
  }

  let generated = 0;
  await db.withTransactionAsync(async () => {
    for (const row of due) {
      let next = row.nextDate;
      let count = 0;
      while (
        next <= now &&
        (row.endDate == null || next <= row.endDate) &&
        count < maxPerSeries
      ) {
        const sameCurrency =
          row.destinationCurrencyCode == null ||
          row.sourceCurrencyCode === row.destinationCurrencyCode;
        const rate = sameCurrency
          ? { rate: 1, date: new Date(next).toISOString().slice(0, 10), provider: "same currency" }
          : resolvedRates.get(row.id);
        if (!rate) {
          throw new Error(
            `Taux indisponible pour ${row.sourceCurrencyCode}/${row.destinationCurrencyCode}.`,
          );
        }
        const destinationAmount = sameCurrency
          ? row.amount
          : convertMinorAmount(
              row.amount,
              row.sourceCurrencyCode,
              row.destinationCurrencyCode!,
              rate.rate,
            );
        await db.runAsync(
          `INSERT INTO transactions
             (type, amount, category_id, account_id, destination_account_id, fee,
              destination_amount, exchange_rate, exchange_rate_date, exchange_rate_provider,
              note, transaction_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row.type,
          row.amount,
          row.categoryId,
          row.accountId,
          row.destinationAccountId,
          row.fee,
          destinationAmount,
          rate.rate,
          rate.date,
          rate.provider,
          row.note,
          next,
          now,
        );
        generated += 1;
        next = advanceDate(next, row.frequency, row.interval);
        count += 1;
      }
      if (next !== row.nextDate) {
        await db.runAsync(
          "UPDATE recurring_transactions SET next_date = ? WHERE id = ?",
          next,
          row.id,
        );
      }
    }
  });

  return generated;
}
