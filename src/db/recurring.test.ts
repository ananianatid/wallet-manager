import type { SQLiteDatabase } from "expo-sqlite";
import { getRateForPair } from "@/currency/service";
import { createTestDb } from "@/test-utils/in-memory-db";
import {
  applyDueRecurring,
  approveRecurringOccurrence,
  createRecurring,
  getRecurringOccurrence,
  listPendingRecurringOccurrences,
  skipRecurringOccurrence,
} from "./recurring";
import type { RecurringTransactionInput } from "@/types";

jest.mock("@/currency/service", () => ({
  getRateForPair: jest.fn(),
}));

describe("applyDueRecurring", () => {
  it("résout les taux multidevises avant la transaction d'écriture", async () => {
    let transactionActive = false;
    const runAsync = jest.fn(async () => ({ changes: 1, lastInsertRowId: 1 }));
    const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
      expect(transactionActive).toBe(false);
      transactionActive = true;
      try {
        await task();
      } finally {
        transactionActive = false;
      }
    });
    const db = {
      getAllAsync: jest.fn(async () => [
        {
          id: 7,
          type: "transfer",
          amount: 10_000,
          categoryId: null,
          categoryName: null,
          categoryIcon: null,
          accountId: 1,
          accountName: "Compte XOF",
          destinationAccountId: 2,
          destinationAccountName: "Compte EUR",
          fee: null,
          sourceCurrencyCode: "XOF",
          destinationCurrencyCode: "EUR",
          note: "Échéance test",
          frequency: "monthly",
          interval: 1,
          startDate: 1,
          nextDate: 1_000,
          endDate: null,
          isActive: 1,
          createdAt: 1,
        },
      ]),
      runAsync,
      withTransactionAsync,
    } as unknown as SQLiteDatabase;

    jest.mocked(getRateForPair).mockImplementation(async () => {
      expect(transactionActive).toBe(false);
      await db.runAsync("INSERT INTO fx_rates");
      return {
        base: "XOF",
        quote: "EUR",
        rate: 0.0015,
        date: "2026-08-18",
        provider: "test",
        fetchedAt: 1,
      };
    });

    await applyDueRecurring(db, 2_000);

    expect(getRateForPair).toHaveBeenCalledWith(db, "XOF", "EUR");
    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenCalledTimes(3);
  });

  it("propose une échéance de façon idempotente sans écrire de transaction", async () => {
    const db = await createTestDb();
    const accountCategory = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE type = 'account' ORDER BY id LIMIT 1",
    );
    await db.runAsync(
      `INSERT INTO accounts (id, name, category_id, currency_code, created_at)
       VALUES (1, 'Compte principal', ?, 'XOF', ?)`,
      accountCategory!.id,
      Date.now(),
    );
    const expenseCategory = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE type = 'expense' ORDER BY id LIMIT 1",
    );
    const now = Date.now();
    const input: RecurringTransactionInput = {
      type: "expense",
      amount: 12_000,
      categoryId: expenseCategory!.id,
      accountId: 1,
      destinationAccountId: null,
      fee: null,
      note: "Loyer",
      frequency: "monthly",
      interval: 1,
      startDate: now - 86_400_000,
      nextDate: now - 86_400_000,
      endDate: null,
      isActive: true,
    };
    const recurringId = await createRecurring(db, input);

    expect(await applyDueRecurring(db, now)).toBe(1);
    expect(await applyDueRecurring(db, now)).toBe(0);
    expect(await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))
      .toMatchObject({ count: 0 });
    const pending = await listPendingRecurringOccurrences(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      recurringTransactionId: recurringId,
      status: "pending",
      snapshot: { amount: 12_000, categoryId: expenseCategory!.id },
    });

    const transactionId = await approveRecurringOccurrence(db, pending[0].id);
    expect(transactionId).toBeGreaterThan(0);
    expect(await approveRecurringOccurrence(db, pending[0].id)).toBe(transactionId);
    expect(await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))
      .toMatchObject({ count: 1 });
    expect((await getRecurringOccurrence(db, pending[0].id))?.status).toBe("approved");
  });

  it("ignore une échéance et la conserve hors des transactions", async () => {
    const db = await createTestDb();
    const accountCategory = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE type = 'account' ORDER BY id LIMIT 1",
    );
    await db.runAsync(
      `INSERT INTO accounts (id, name, category_id, currency_code, created_at)
       VALUES (1, 'Compte principal', ?, 'XOF', ?)`,
      accountCategory!.id,
      Date.now(),
    );
    const expenseCategory = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE type = 'expense' ORDER BY id LIMIT 1",
    );
    const now = Date.now();
    await createRecurring(db, {
      type: "expense",
      amount: 5_000,
      categoryId: expenseCategory!.id,
      accountId: 1,
      destinationAccountId: null,
      fee: null,
      note: null,
      frequency: "monthly",
      interval: 1,
      startDate: now - 86_400_000,
      nextDate: now - 86_400_000,
      endDate: null,
      isActive: true,
    });
    await applyDueRecurring(db, now);
    const occurrence = (await listPendingRecurringOccurrences(db))[0];
    await skipRecurringOccurrence(db, occurrence.id);
    expect((await getRecurringOccurrence(db, occurrence.id))?.status).toBe("skipped");
    expect(await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))
      .toMatchObject({ count: 0 });
  });
});
