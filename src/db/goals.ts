import type { SQLiteDatabase } from "expo-sqlite";
import { getAccountAvailableBalance } from "./accounts";
import { convertMinorAmount } from "@/currency/currencies";
import { getRateForPair } from "@/currency/service";
import type {
  Goal,
  GoalInput,
  GoalReservation,
  GoalReservationInput,
  GoalStatus,
} from "../types";

interface GoalRow {
  id: number;
  name: string;
  description: string | null;
  imageUri: string | null;
  linkUrl: string | null;
  targetAmount: number;
  currencyCode: string;
  targetDate: number;
  status: GoalStatus;
  createdAt: number;
  reservedAmount: number;
}

interface ReservationRow {
  id: number;
  goalId: number;
  sourceAccountId: number;
  sourceAccountName: string;
  sourceCurrencyCode: string;
  amount: number;
  referenceAmount: number;
  referenceCurrency: string;
  exchangeRate: number;
  exchangeRateDate: string | null;
  exchangeRateProvider: string | null;
  note: string | null;
  reservationDate: number;
  createdAt: number;
  releasedAt: number | null;
}

function monthCountUntil(targetDate: number, now = new Date()): number {
  const target = new Date(targetDate);
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(1, months);
}

function mapGoal(row: GoalRow): Goal {
  const remainingAmount = Math.max(0, row.targetAmount - row.reservedAmount);
  const isAchieved = row.reservedAmount >= row.targetAmount;
  const isOverdue = row.targetDate < Date.now() && !isAchieved;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUri: row.imageUri,
    linkUrl: row.linkUrl,
    targetAmount: row.targetAmount,
    currencyCode: row.currencyCode,
    targetDate: row.targetDate,
    status: row.status,
    createdAt: row.createdAt,
    reservedAmount: row.reservedAmount,
    remainingAmount,
    progressPercent: Math.min(
      100,
      Math.round((row.reservedAmount / row.targetAmount) * 100),
    ),
    monthlyRequired: Math.ceil(remainingAmount / monthCountUntil(row.targetDate)),
    isAchieved,
    isOverdue,
  };
}

function mapReservation(row: ReservationRow): GoalReservation {
  return {
    id: row.id,
    goalId: row.goalId,
    sourceAccountId: row.sourceAccountId,
    sourceAccountName: row.sourceAccountName,
    sourceCurrencyCode: row.sourceCurrencyCode,
    amount: row.amount,
    referenceAmount: row.referenceAmount,
    referenceCurrency: row.referenceCurrency,
    exchangeRate: row.exchangeRate,
    exchangeRateDate: row.exchangeRateDate,
    exchangeRateProvider: row.exchangeRateProvider,
    note: row.note,
    reservationDate: row.reservationDate,
    createdAt: row.createdAt,
    releasedAt: row.releasedAt,
  };
}

const GOAL_FIELDS = `
  g.id,
  g.name,
  g.description,
  g.image_uri AS imageUri,
  g.link_url AS linkUrl,
  g.target_amount AS targetAmount,
  g.currency_code AS currencyCode,
  g.target_date AS targetDate,
  g.status,
  g.created_at AS createdAt,
  COALESCE(SUM(CASE WHEN r.released_at IS NULL THEN r.reference_amount ELSE 0 END), 0) AS reservedAmount
`;

function validateGoalInput(input: GoalInput): GoalInput {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom de l'objectif ne peut pas être vide.");
  }
  if (!Number.isInteger(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error("Le montant cible doit être un entier positif.");
  }
  if (!Number.isInteger(input.targetDate)) {
    throw new Error("La date cible est invalide.");
  }
  return {
    name,
    description: input.description?.trim() || null,
    imageUri: input.imageUri?.trim() || null,
    linkUrl: input.linkUrl?.trim() || null,
    targetAmount: input.targetAmount,
    targetDate: input.targetDate,
    currencyCode: input.currencyCode,
  };
}

export async function listGoals(db: SQLiteDatabase): Promise<Goal[]> {
  const rows = await db.getAllAsync<GoalRow>(
    `SELECT ${GOAL_FIELDS}
     FROM goals g
     LEFT JOIN goal_reservations r ON r.goal_id = g.id
     GROUP BY g.id
     ORDER BY CASE WHEN g.status = 'active' THEN 0 ELSE 1 END,
              g.target_date ASC,
              g.created_at DESC`,
  );
  return rows.map(mapGoal);
}

export async function getGoal(
  db: SQLiteDatabase,
  id: number,
): Promise<Goal | null> {
  const row = await db.getFirstAsync<GoalRow>(
    `SELECT ${GOAL_FIELDS}
     FROM goals g
     LEFT JOIN goal_reservations r ON r.goal_id = g.id
     WHERE g.id = ?
     GROUP BY g.id`,
    id,
  );
  return row ? mapGoal(row) : null;
}

export async function createGoal(
  db: SQLiteDatabase,
  input: GoalInput,
): Promise<number> {
  const valid = validateGoalInput(input);
  const result = valid.currencyCode == null
    ? await db.runAsync(
        `INSERT INTO goals (name, description, image_uri, link_url, target_amount, target_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        valid.name,
        valid.description ?? null,
        valid.imageUri ?? null,
        valid.linkUrl ?? null,
        valid.targetAmount,
        valid.targetDate,
        Date.now(),
      )
    : await db.runAsync(
        `INSERT INTO goals (name, description, image_uri, link_url, target_amount, target_date, created_at, currency_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        valid.name,
        valid.description ?? null,
        valid.imageUri ?? null,
        valid.linkUrl ?? null,
        valid.targetAmount,
        valid.targetDate,
        Date.now(),
        valid.currencyCode,
      );
  return Number(result.lastInsertRowId);
}

export async function updateGoal(
  db: SQLiteDatabase,
  id: number,
  input: GoalInput,
): Promise<void> {
  const valid = validateGoalInput(input);
  const result = valid.currencyCode == null
    ? await db.runAsync(
        "UPDATE goals SET name = ?, description = ?, image_uri = ?, link_url = ?, target_amount = ?, target_date = ? WHERE id = ?",
        valid.name,
        valid.description ?? null,
        valid.imageUri ?? null,
        valid.linkUrl ?? null,
        valid.targetAmount,
        valid.targetDate,
        id,
      )
    : await db.runAsync(
        "UPDATE goals SET name = ?, description = ?, image_uri = ?, link_url = ?, target_amount = ?, target_date = ?, currency_code = ? WHERE id = ?",
        valid.name,
        valid.description ?? null,
        valid.imageUri ?? null,
        valid.linkUrl ?? null,
        valid.targetAmount,
        valid.targetDate,
        valid.currencyCode,
        id,
      );
  if (result.changes === 0) {
    throw new Error("Objectif introuvable.");
  }
}

export async function closeGoal(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync("UPDATE goals SET status = 'closed' WHERE id = ?", id);
}

export async function deleteGoal(db: SQLiteDatabase, id: number): Promise<void> {
  const active = await db.getFirstAsync<{ active: number }>(
    "SELECT EXISTS(SELECT 1 FROM goal_reservations WHERE goal_id = ? AND released_at IS NULL) AS active",
    id,
  );
  if (active?.active) {
    throw new Error("Libérez d'abord les réservations de cet objectif.");
  }
  await db.runAsync("DELETE FROM goals WHERE id = ?", id);
}

export async function listGoalReservations(
  db: SQLiteDatabase,
  goalId: number,
): Promise<GoalReservation[]> {
  const rows = await db.getAllAsync<ReservationRow>(
    `SELECT r.id,
            r.goal_id AS goalId,
            r.source_account_id AS sourceAccountId,
            a.name AS sourceAccountName,
            a.currency_code AS sourceCurrencyCode,
            r.amount,
            r.reference_amount AS referenceAmount,
            r.reference_currency AS referenceCurrency,
            r.exchange_rate AS exchangeRate,
            r.exchange_rate_date AS exchangeRateDate,
            r.exchange_rate_provider AS exchangeRateProvider,
            r.note,
            r.reservation_date AS reservationDate,
            r.created_at AS createdAt,
            r.released_at AS releasedAt
     FROM goal_reservations r
     JOIN accounts a ON a.id = r.source_account_id AND a.deleted_at IS NULL
     WHERE r.goal_id = ?
     ORDER BY r.reservation_date DESC, r.created_at DESC`,
    goalId,
  );
  return rows.map(mapReservation);
}

export async function createGoalReservation(
  db: SQLiteDatabase,
  input: GoalReservationInput,
): Promise<number> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Le montant réservé doit être un entier positif.");
  }
  if (!Number.isInteger(input.reservationDate)) {
    throw new Error("La date de réservation est invalide.");
  }
  const goal = await db.getFirstAsync<{ status: GoalStatus; currencyCode: string }>(
    "SELECT status, currency_code AS currencyCode FROM goals WHERE id = ?",
    input.goalId,
  );
  if (!goal) {
    throw new Error("Objectif introuvable.");
  }
  if (goal.status !== "active") {
    throw new Error("Cet objectif est clôturé.");
  }
  const available = await getAccountAvailableBalance(db, input.sourceAccountId);
  if (input.amount > available) {
    throw new Error(
      `Solde disponible insuffisant. Disponible : ${available.toLocaleString("fr-FR")} .`,
    );
  }
  const account = await db.getFirstAsync<{ currencyCode: string }>(
    "SELECT currency_code AS currencyCode FROM accounts WHERE id = ?",
    input.sourceAccountId,
  );
  const sourceCurrency = account?.currencyCode ?? "XOF";
  const rate =
    input.exchangeRate != null
      ? {
          rate: input.exchangeRate,
          date: input.exchangeRateDate ?? new Date().toISOString().slice(0, 10),
          provider: input.exchangeRateProvider ?? "manual",
        }
      : await getRateForPair(db, sourceCurrency, goal.currencyCode);
  if (!rate) {
    throw new Error(
      `Taux indisponible pour ${sourceCurrency}/${goal.currencyCode}.`,
    );
  }
  const referenceAmount =
    input.referenceAmount ??
    convertMinorAmount(
      input.amount,
      sourceCurrency,
      goal.currencyCode,
      rate.rate,
    );
  if (!Number.isInteger(referenceAmount) || referenceAmount <= 0) {
    throw new Error("Le montant converti de la réservation est invalide.");
  }
  const result = await db.runAsync(
    `INSERT INTO goal_reservations
       (goal_id, source_account_id, amount, reference_amount, reference_currency,
        exchange_rate, exchange_rate_date, exchange_rate_provider, note, reservation_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.goalId,
    input.sourceAccountId,
    input.amount,
    referenceAmount,
    goal.currencyCode,
    rate.rate,
    rate.date,
    rate.provider,
    input.note?.trim() || null,
    input.reservationDate,
    Date.now(),
  );
  return Number(result.lastInsertRowId);
}

export async function releaseGoalReservation(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync(
    "UPDATE goal_reservations SET released_at = ? WHERE id = ? AND released_at IS NULL",
    Date.now(),
    id,
  );
}
