import type { SQLiteDatabase } from "expo-sqlite";
import { createGoalReservation } from "@/db/goals";
import { createTransaction, updateTransaction } from "@/db/transactions";
import { saveTransactionWorkflow } from "./transaction-workflow";

jest.mock("@/db/goals", () => ({ createGoalReservation: jest.fn() }));
jest.mock("@/db/transactions", () => ({
  createTransaction: jest.fn(),
  updateTransaction: jest.fn(),
}));

const db = {} as SQLiteDatabase;
const transaction = {
  type: "expense" as const,
  amount: 100,
  categoryId: 1,
  accountId: 1,
  destinationAccountId: null,
  fee: null,
  note: null,
  transactionDate: 1,
};

describe("saveTransactionWorkflow", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a new transaction behind the workflow seam", async () => {
    jest.mocked(createTransaction).mockResolvedValue(42);

    await expect(
      saveTransactionWorkflow(db, {
        transactionId: null,
        goalReservation: null,
        transaction,
      }),
    ).resolves.toEqual({ kind: "created", id: 42 });
    expect(createTransaction).toHaveBeenCalledWith(db, transaction);
  });

  it("updates an existing transaction behind the workflow seam", async () => {
    await expect(
      saveTransactionWorkflow(db, {
        transactionId: 7,
        goalReservation: null,
        transaction,
      }),
    ).resolves.toEqual({ kind: "updated", id: 7 });
    expect(updateTransaction).toHaveBeenCalledWith(db, 7, transaction);
  });

  it("uses the reservation adapter for goal transfers", async () => {
    jest.mocked(createGoalReservation).mockResolvedValue(9);
    const reservation = {
      goalId: 3,
      sourceAccountId: 1,
      amount: 100,
      note: null,
      reservationDate: 1,
    };

    await expect(
      saveTransactionWorkflow(db, {
        transactionId: null,
        goalReservation: reservation,
        transaction: null,
      }),
    ).resolves.toEqual({ kind: "goal-reservation", id: 9 });
    expect(createGoalReservation).toHaveBeenCalledWith(db, reservation);
  });
});
