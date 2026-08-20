import type { SQLiteDatabase } from "expo-sqlite";
import { createTestDb } from "@/test-utils/in-memory-db";
import { createTransaction, deleteTransaction, updateTransaction } from "./transactions";
import {
  listReimbursementsForTransaction,
  settleReimbursement,
} from "./journal";
import type { TransactionInput } from "@/types";

async function ids(db: SQLiteDatabase): Promise<{ income: number; expense: number }> {
  const rows = await db.getAllAsync<{ id: number; type: string }>(
    "SELECT id, type FROM categories WHERE type IN ('income', 'expense') ORDER BY id",
  );
  return {
    income: rows.find((row) => row.type === "income")!.id,
    expense: rows.find((row) => row.type === "expense")!.id,
  };
}

async function setupDb(): Promise<SQLiteDatabase> {
  const db = await createTestDb();
  const accountCategory = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM categories WHERE type = 'account' ORDER BY id LIMIT 1",
  );
  await db.runAsync(
    `INSERT INTO accounts (id, name, category_id, currency_code, created_at)
     VALUES (1, 'Compte principal', ?, 'XOF', 1),
            (2, 'Compte secondaire', ?, 'XOF', 1)`,
    accountCategory!.id,
    accountCategory!.id,
  );
  return db;
}

function input(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    type: "expense",
    amount: 10_000,
    categoryId: 15,
    accountId: 1,
    destinationAccountId: null,
    fee: null,
    note: null,
    transactionDate: 1_700_000_000_000,
    ...overrides,
  };
}

describe("journal financier", () => {
  it("enregistre un fractionnement exact et refuse une somme incorrecte", async () => {
    const db = await setupDb();
    const categoryRows = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM categories WHERE type = 'expense' ORDER BY id LIMIT 2",
    );
    const transactionId = await createTransaction(
      db,
      input({
        categoryId: null,
        allocations: [
          { categoryId: categoryRows[0].id, amount: 6_000 },
          { categoryId: categoryRows[1].id, amount: 4_000 },
        ],
      }),
    );
    expect(
      await db.getAllAsync("SELECT * FROM transaction_splits WHERE transaction_id = ?", transactionId),
    ).toHaveLength(2);

    await expect(
      createTransaction(
        db,
        input({
          categoryId: null,
          allocations: [{ categoryId: categoryRows[0].id, amount: 9_999 }],
        }),
      ),
    ).rejects.toThrow("exactement égale");
    await expect(
      createTransaction(
        db,
        input({
          type: "transfer",
          categoryId: null,
          destinationAccountId: 2,
          allocations: [{ categoryId: categoryRows[0].id, amount: 10_000 }],
        }),
      ),
    ).rejects.toThrow("ne peut pas être fractionné");
  });

  it("crée une dette puis accepte des règlements partiels sans écriture silencieuse", async () => {
    const db = await setupDb();
    const { expense, income } = await ids(db);
    const debtTransactionId = await createTransaction(
      db,
      input({
        categoryId: expense,
        reimbursements: [
          { personName: "Alice", direction: "owed_to_me", amount: 7_000 },
        ],
      }),
    );
    const debt = (await listReimbursementsForTransaction(db, debtTransactionId))[0];
    expect(debt.remainingAmount).toBe(7_000);
    expect(await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))
      .toMatchObject({ count: 1 });

    const settlementInput = input({
      type: "income",
      amount: 3_000,
      categoryId: income,
      note: "Règlement Alice",
      reimbursements: undefined,
    });
    const first = await settleReimbursement(db, debt.id, 3_000, settlementInput);
    expect(first.transactionId).toBeGreaterThan(debtTransactionId);
    expect((await listReimbursementsForTransaction(db, debtTransactionId))[0]).toMatchObject({
      settledAmount: 3_000,
      remainingAmount: 4_000,
    });

    await settleReimbursement(db, debt.id, 4_000, {
      ...settlementInput,
      amount: 4_000,
      transactionDate: settlementInput.transactionDate + 1,
    });
    await expect(
      settleReimbursement(db, debt.id, 1, {
        ...settlementInput,
        amount: 1,
        transactionDate: settlementInput.transactionDate + 2,
      }),
    ).rejects.toThrow("solde restant");
  });

  it("protège une dette réglée contre la modification et la suppression", async () => {
    const db = await setupDb();
    const { expense, income } = await ids(db);
    const debtTransactionId = await createTransaction(
      db,
      input({
        categoryId: expense,
        reimbursements: [{ personName: "Bob", direction: "i_owe", amount: 1_000 }],
      }),
    );
    const debt = (await listReimbursementsForTransaction(db, debtTransactionId))[0];
    await settleReimbursement(db, debt.id, 1_000, {
      ...input({ type: "expense", amount: 1_000, categoryId: expense }),
    });
    await expect(updateTransaction(db, debtTransactionId, input({ categoryId: expense })))
      .rejects.toThrow("déjà réglée");
    await expect(deleteTransaction(db, debtTransactionId)).rejects.toThrow("déjà réglée");
  });
});
