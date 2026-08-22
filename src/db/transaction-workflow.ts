import type { SQLiteDatabase } from "expo-sqlite";
import { createGoalReservation } from "@/db/goals";
import { createTransaction, updateTransaction } from "@/db/transactions";
import type { GoalReservationInput, TransactionInput } from "@/types";

export interface SaveTransactionCommand {
  transactionId: number | null;
  goalReservation: GoalReservationInput | null;
  transaction: TransactionInput | null;
}

export type SaveTransactionResult =
  | { kind: "goal-reservation"; id: number }
  | { kind: "created"; id: number }
  | { kind: "updated"; id: number };

/**
 * Owns the persistence branch for the transaction editor. The screen only
 * prepares a validated command; SQLite details and create/update semantics
 * stay behind this module's interface.
 */
export async function saveTransactionWorkflow(
  db: SQLiteDatabase,
  command: SaveTransactionCommand,
): Promise<SaveTransactionResult> {
  if (command.goalReservation) {
    if (command.transactionId != null) {
      throw new Error("Une réservation d'objectif ne se modifie pas comme une transaction.");
    }
    const id = await createGoalReservation(db, command.goalReservation);
    return { kind: "goal-reservation", id };
  }

  if (!command.transaction) {
    throw new Error("Commande de transaction vide.");
  }

  if (command.transactionId != null) {
    await updateTransaction(db, command.transactionId, command.transaction);
    return { kind: "updated", id: command.transactionId };
  }

  const id = await createTransaction(db, command.transaction);
  return { kind: "created", id };
}
