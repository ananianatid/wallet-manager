import {
  closeGoal,
  createGoal,
  deleteGoal,
  getGoal,
  listGoalReservations,
  listGoals,
  releaseGoalReservation,
  updateGoal,
} from "@/db/goals";
import { getDatabase } from "@/db/database";
import type { GoalInput } from "@/types";

export async function loadGoals() { return listGoals(await getDatabase()); }

export async function loadGoalDetail(goalId: number) {
  const db = await getDatabase();
  const [goal, reservations] = await Promise.all([getGoal(db, goalId), listGoalReservations(db, goalId)]);
  return { goal, reservations };
}

export async function createLocalGoal(input: GoalInput): Promise<number> { return createGoal(await getDatabase(), input); }
export async function updateLocalGoal(id: number, input: GoalInput): Promise<void> { await updateGoal(await getDatabase(), id, input); }
export async function closeLocalGoal(id: number): Promise<void> { await closeGoal(await getDatabase(), id); }
export async function deleteLocalGoal(id: number): Promise<void> { await deleteGoal(await getDatabase(), id); }
export async function releaseLocalGoalReservation(id: number): Promise<void> { await releaseGoalReservation(await getDatabase(), id); }
