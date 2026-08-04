import type { SQLiteDatabase } from "expo-sqlite";
import { getAccountAvailableBalance } from "./accounts";
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
  targetAmount: number;
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
  amount: number;
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
    targetAmount: row.targetAmount,
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
    amount: row.amount,
    note: row.note,
    reservationDate: row.reservationDate,
    createdAt: row.createdAt,
    releasedAt: row.releasedAt,
  };
}

const GOAL_FIELDS = `
  g.id,
  g.name,
  g.target_amount AS targetAmount,
  g.target_date AS targetDate,
  g.status,
  g.created_at AS createdAt,
  COALESCE(SUM(CASE WHEN r.released_at IS NULL THEN r.amount ELSE 0 END), 0) AS reservedAmount
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
  return { name, targetAmount: input.targetAmount, targetDate: input.targetDate };
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
  const result = await db.runAsync(
    `INSERT INTO goals (name, target_amount, target_date, created_at)
     VALUES (?, ?, ?, ?)`,
    valid.name,
    valid.targetAmount,
    valid.targetDate,
    Date.now(),
  );
  return Number(result.lastInsertRowId);
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
            r.amount,
            r.note,
            r.reservation_date AS reservationDate,
            r.created_at AS createdAt,
            r.released_at AS releasedAt
     FROM goal_reservations r
     JOIN accounts a ON a.id = r.source_account_id
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
  const goal = await db.getFirstAsync<{ status: GoalStatus }>(
    "SELECT status FROM goals WHERE id = ?",
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
      `Solde disponible insuffisant. Disponible : ${available.toLocaleString("fr-FR")} F.`,
    );
  }
  const result = await db.runAsync(
    `INSERT INTO goal_reservations
       (goal_id, source_account_id, amount, note, reservation_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.goalId,
    input.sourceAccountId,
    input.amount,
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
