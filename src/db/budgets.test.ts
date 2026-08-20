import type { SQLiteDatabase } from "expo-sqlite";
import { createTestDb } from "@/test-utils/in-memory-db";
import { createTransaction } from "./transactions";
import {
  getBudgetSnapshot,
  setBudgetPeriodAmount,
  setBudgetPlan,
} from "./budgets";

function monthAt(offset: number): { key: string; date: number } {
  const date = new Date();
  date.setDate(15);
  date.setHours(12, 0, 0, 0);
  date.setMonth(date.getMonth() + offset);
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    date: date.getTime(),
  };
}

async function setupDb(): Promise<{
  db: SQLiteDatabase;
  expenseA: number;
  expenseB: number;
  accountA: number;
  accountB: number;
}> {
  const db = await createTestDb();
  const accountCategory = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM categories WHERE type = 'account' ORDER BY id LIMIT 1",
  );
  await db.runAsync(
    `INSERT INTO accounts (id, name, category_id, currency_code, created_at)
     VALUES (1, 'Compte A', ?, 'XOF', ?),
            (2, 'Compte B', ?, 'XOF', ?)`,
    accountCategory!.id,
    Date.now(),
    accountCategory!.id,
    Date.now(),
  );
  const categories = await db.getAllAsync<{ id: number }>(
    "SELECT id FROM categories WHERE type = 'expense' ORDER BY id LIMIT 2",
  );
  return {
    db,
    expenseA: categories[0].id,
    expenseB: categories[1].id,
    accountA: 1,
    accountB: 2,
  };
}

async function expense(
  db: SQLiteDatabase,
  categoryId: number | null,
  amount: number,
  transactionDate: number,
  allocations?: { categoryId: number; amount: number }[],
): Promise<void> {
  await createTransaction(db, {
    type: "expense",
    amount,
    categoryId,
    accountId: 1,
    destinationAccountId: null,
    fee: null,
    note: null,
    transactionDate,
    allocations,
  });
}

describe("budgets mensuels", () => {
  it("compte les répartitions une seule fois dans le budget de catégorie", async () => {
    const { db, expenseA, expenseB } = await setupDb();
    const current = monthAt(0);
    const planId = await setBudgetPlan(db, expenseA, 100_000, "XOF");
    await expense(db, null, 10_000, current.date, [
      { categoryId: expenseA, amount: 6_000 },
      { categoryId: expenseB, amount: 4_000 },
    ]);

    const categorySnapshot = (await getBudgetSnapshot(db, current.key))[0];
    expect(categorySnapshot).toMatchObject({
      planId,
      plannedAmount: 100_000,
      spent: 6_000,
      available: 94_000,
    });
  });

  it("reporte un solde positif et un dépassement signé", async () => {
    const positive = await setupDb();
    const current = monthAt(0);
    const next = monthAt(1);
    const positivePlan = await setBudgetPlan(
      positive.db,
      positive.expenseA,
      100_000,
      "XOF",
      true,
    );
    await positive.db.runAsync(
      "UPDATE budget_plans SET created_at = ? WHERE id = ?",
      new Date(current.key + "-01T00:00:00").getTime(),
      positivePlan,
    );
    await expense(positive.db, positive.expenseA, 60_000, current.date);
    expect((await getBudgetSnapshot(positive.db, next.key))[0]).toMatchObject({
      rolloverIn: 40_000,
      available: 140_000,
    });

    const negative = await setupDb();
    const negativePlan = await setBudgetPlan(
      negative.db,
      negative.expenseA,
      100_000,
      "XOF",
      true,
    );
    await negative.db.runAsync(
      "UPDATE budget_plans SET created_at = ? WHERE id = ?",
      new Date(current.key + "-01T00:00:00").getTime(),
      negativePlan,
    );
    await expense(negative.db, negative.expenseA, 120_000, current.date);
    expect((await getBudgetSnapshot(negative.db, next.key))[0]).toMatchObject({
      rolloverIn: -20_000,
      plannedAmount: 100_000,
      available: 80_000,
    });
  });

  it("modifie un mois précis sans réécrire le mois suivant", async () => {
    const { db, expenseA } = await setupDb();
    const current = monthAt(0);
    const next = monthAt(1);
    const planId = await setBudgetPlan(db, expenseA, 100_000, "XOF");
    await setBudgetPeriodAmount(db, planId, current.key, 75_000);

    const snapshots = await getBudgetSnapshot(db, current.key);
    expect(snapshots[0].plannedAmount).toBe(75_000);
    expect((await getBudgetSnapshot(db, next.key))[0].plannedAmount).toBe(100_000);
  });

  it("exclut les transferts du budget global", async () => {
    const { db, accountA, accountB } = await setupDb();
    const current = monthAt(0);
    const planId = await setBudgetPlan(db, null, 100_000, "XOF");
    await createTransaction(db, {
      type: "transfer",
      amount: 50_000,
      categoryId: null,
      accountId: accountA,
      destinationAccountId: accountB,
      fee: null,
      note: null,
      transactionDate: current.date,
    });

    expect((await getBudgetSnapshot(db, current.key))[0]).toMatchObject({
      planId,
      spent: 0,
      available: 100_000,
    });
  });
});
