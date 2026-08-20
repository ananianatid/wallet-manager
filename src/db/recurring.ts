import type { SQLiteDatabase } from "expo-sqlite";
import { normalizeCategoryIcon } from "@/constants/category-icons";
import type {
  Frequency,
  RecurringOccurrence,
  RecurringOccurrenceSnapshot,
  RecurringOccurrenceStatus,
  RecurringTransaction,
  RecurringTransactionInput,
  TransactionInput,
  TransactionType,
} from "../types";
import { convertMinorAmount } from "@/currency/currencies";
import { getRateForPair } from "@/currency/service";
import { insertJournalTransaction } from "./journal";

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
  mode: "approval" | "automatic";
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
  r.mode,
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
    mode: row.mode,
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
        mode: input.mode ?? "approval",
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
      return { ...input, categoryId: null, fee, note, mode: input.mode ?? "approval" };
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
        frequency, interval, start_date, next_date, end_date, mode, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    valid.mode ?? "approval",
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
       end_date = ?, mode = ?, is_active = ?
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
    valid.mode ?? "approval",
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

interface RecurringOccurrenceRow {
  id: number;
  recurringTransactionId: number;
  occurrenceDate: number;
  status: RecurringOccurrenceStatus;
  snapshotJson: string;
  transactionId: number | null;
  notificationId: string | null;
  createdAt: number;
  decidedAt: number | null;
}

function buildSnapshot(
  row: RecurringRow,
  occurrenceDate: number,
  rate: { rate: number; date: string; provider: string },
): RecurringOccurrenceSnapshot {
  const sameCurrency =
    row.destinationCurrencyCode == null || row.sourceCurrencyCode === row.destinationCurrencyCode;
  return {
    type: row.type,
    amount: row.amount,
    categoryId: row.categoryId,
    accountId: row.accountId,
    destinationAccountId: row.destinationAccountId,
    fee: row.fee,
    note: row.note,
    transactionDate: occurrenceDate,
    destinationAmount: sameCurrency
      ? row.type === "transfer"
        ? row.amount
        : null
      : convertMinorAmount(
          row.amount,
          row.sourceCurrencyCode,
          row.destinationCurrencyCode!,
          rate.rate,
        ),
    exchangeRate: row.type === "transfer" ? rate.rate : null,
    exchangeRateDate: row.type === "transfer" ? rate.date : null,
    exchangeRateProvider: row.type === "transfer" ? rate.provider : null,
    sourceCurrencyCode: row.sourceCurrencyCode,
    destinationCurrencyCode: row.destinationCurrencyCode,
  };
}

function mapOccurrence(row: RecurringOccurrenceRow): RecurringOccurrence {
  let snapshot: RecurringOccurrenceSnapshot;
  try {
    snapshot = JSON.parse(row.snapshotJson) as RecurringOccurrenceSnapshot;
  } catch {
    throw new Error("L’échéance récurrente contient un instantané invalide.");
  }
  return {
    id: row.id,
    recurringTransactionId: row.recurringTransactionId,
    occurrenceDate: row.occurrenceDate,
    status: row.status,
    snapshot,
    transactionId: row.transactionId,
    notificationId: row.notificationId,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
  };
}

async function resolveRecurringRates(
  db: SQLiteDatabase,
  rows: RecurringRow[],
): Promise<Map<number, { rate: number; date: string; provider: string }>> {
  const resolved = new Map<number, { rate: number; date: string; provider: string }>();
  for (const row of rows) {
    const sameCurrency =
      row.destinationCurrencyCode == null || row.sourceCurrencyCode === row.destinationCurrencyCode;
    if (row.type !== "transfer" || sameCurrency) {
      resolved.set(row.id, {
        rate: 1,
        date: new Date(row.nextDate).toISOString().slice(0, 10),
        provider: "same currency",
      });
      continue;
    }
    const rate = await getRateForPair(db, row.sourceCurrencyCode, row.destinationCurrencyCode!);
    if (!rate) {
      throw new Error(
        `Taux indisponible pour ${row.sourceCurrencyCode}/${row.destinationCurrencyCode}.`,
      );
    }
    resolved.set(row.id, rate);
  }
  return resolved;
}

export async function ensureDueRecurringOccurrences(
  db: SQLiteDatabase,
  now = Date.now(),
  maxPerSeries = MAX_OCCURRENCES_PER_SERIES,
): Promise<number> {
  if (!Number.isInteger(maxPerSeries) || maxPerSeries <= 0) {
    throw new Error("La limite d’échéances doit être un entier positif.");
  }
  const due = await db.getAllAsync<RecurringRow>(
    `SELECT ${SELECT_FIELDS}
     ${FROM_JOINS}
     WHERE r.is_active = 1
       AND r.next_date <= ?
       AND (r.end_date IS NULL OR r.next_date <= r.end_date)
     ORDER BY r.next_date ASC`,
    now,
  );

  if (due.length === 0) {
    return 0;
  }

  // Resolve rates before the write transaction because the rate cache may write
  // to SQLite itself. No transaction row is created here: this only proposes
  // occurrences for explicit approval.
  const resolvedRates = await resolveRecurringRates(db, due);
  let proposed = 0;
  await db.withTransactionAsync(async () => {
    for (const row of due) {
      let next = row.nextDate;
      let count = 0;
      while (
        next <= now &&
        (row.endDate == null || next <= row.endDate) &&
        count < maxPerSeries
      ) {
        const rate = resolvedRates.get(row.id);
        if (!rate) {
          throw new Error(
            `Taux indisponible pour ${row.sourceCurrencyCode}/${row.destinationCurrencyCode}.`,
          );
        }
        const snapshot = buildSnapshot(row, next, rate);
        const inserted = await db.runAsync(
          `INSERT OR IGNORE INTO recurring_occurrences
             (recurring_transaction_id, occurrence_date, status, snapshot_json, created_at)
           VALUES (?, ?, 'pending', ?, ?)`,
          row.id,
          next,
          JSON.stringify(snapshot),
          now,
        );
        proposed += Number(inserted.changes) > 0 ? 1 : 0;
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

  return proposed;
}

export const applyDueRecurring = ensureDueRecurringOccurrences;

export async function listPendingRecurringOccurrences(
  db: SQLiteDatabase,
): Promise<RecurringOccurrence[]> {
  const rows = await db.getAllAsync<RecurringOccurrenceRow>(
    `SELECT id,
            recurring_transaction_id AS recurringTransactionId,
            occurrence_date AS occurrenceDate,
            status,
            snapshot_json AS snapshotJson,
            transaction_id AS transactionId,
            notification_id AS notificationId,
            created_at AS createdAt,
            decided_at AS decidedAt
     FROM recurring_occurrences
     WHERE status = 'pending'
     ORDER BY occurrence_date ASC, id ASC`,
  );
  return rows.map(mapOccurrence);
}

export async function getRecurringOccurrence(
  db: SQLiteDatabase,
  id: number,
): Promise<RecurringOccurrence | null> {
  const row = await db.getFirstAsync<RecurringOccurrenceRow>(
    `SELECT id,
            recurring_transaction_id AS recurringTransactionId,
            occurrence_date AS occurrenceDate,
            status,
            snapshot_json AS snapshotJson,
            transaction_id AS transactionId,
            notification_id AS notificationId,
            created_at AS createdAt,
            decided_at AS decidedAt
     FROM recurring_occurrences
     WHERE id = ?`,
    id,
  );
  return row ? mapOccurrence(row) : null;
}

export async function setRecurringOccurrenceNotificationId(
  db: SQLiteDatabase,
  occurrenceId: number,
  notificationId: string,
): Promise<void> {
  await db.runAsync(
    "UPDATE recurring_occurrences SET notification_id = ? WHERE id = ? AND status = 'pending'",
    notificationId,
    occurrenceId,
  );
}

export async function approveRecurringOccurrence(
  db: SQLiteDatabase,
  occurrenceId: number,
): Promise<number> {
  const occurrence = await getRecurringOccurrence(db, occurrenceId);
  if (!occurrence) throw new Error("L’échéance récurrente est introuvable.");
  if (occurrence.status === "approved" && occurrence.transactionId != null) {
    return occurrence.transactionId;
  }
  if (occurrence.status !== "pending") {
    throw new Error("Cette échéance a déjà été ignorée.");
  }
  let transactionId = 0;
  await db.withTransactionAsync(async () => {
    const current = await getRecurringOccurrence(db, occurrenceId);
    if (!current) throw new Error("L’échéance récurrente est introuvable.");
    if (current.status === "approved" && current.transactionId != null) {
      transactionId = current.transactionId;
      return;
    }
    if (current.status !== "pending") {
      throw new Error("Cette échéance a déjà été ignorée.");
    }
    const input: TransactionInput = {
      type: current.snapshot.type,
      amount: current.snapshot.amount,
      categoryId: current.snapshot.categoryId,
      accountId: current.snapshot.accountId,
      destinationAccountId: current.snapshot.destinationAccountId,
      fee: current.snapshot.fee,
      note: current.snapshot.note,
      transactionDate: current.snapshot.transactionDate,
      destinationAmount: current.snapshot.destinationAmount,
      exchangeRate: current.snapshot.exchangeRate,
      exchangeRateDate: current.snapshot.exchangeRateDate,
      exchangeRateProvider: current.snapshot.exchangeRateProvider,
    };
    transactionId = await insertJournalTransaction(db, input);
    await db.runAsync(
      `UPDATE recurring_occurrences
       SET status = 'approved', transaction_id = ?, notification_id = NULL, decided_at = ?
       WHERE id = ? AND status = 'pending'`,
      transactionId,
      Date.now(),
      occurrenceId,
    );
  });
  return transactionId;
}

export async function skipRecurringOccurrence(
  db: SQLiteDatabase,
  occurrenceId: number,
): Promise<void> {
  const result = await db.runAsync(
    `UPDATE recurring_occurrences
     SET status = 'skipped', notification_id = NULL, decided_at = ?
     WHERE id = ? AND status = 'pending'`,
    Date.now(),
    occurrenceId,
  );
  if (Number(result.changes) !== 1) {
    throw new Error("Cette échéance n’est plus en attente.");
  }
}

export async function rescheduleRecurringOccurrence(
  db: SQLiteDatabase,
  occurrenceId: number,
  nextDate: number,
): Promise<void> {
  if (!Number.isInteger(nextDate)) {
    throw new Error("La nouvelle date est invalide.");
  }
  const result = await db.runAsync(
    `UPDATE recurring_occurrences
     SET occurrence_date = ?, notification_id = NULL
     WHERE id = ? AND status = 'pending'`,
    nextDate,
    occurrenceId,
  );
  if (Number(result.changes) !== 1) {
    throw new Error("Cette échéance n’est plus en attente.");
  }
}
