import type { SQLiteDatabase } from "expo-sqlite";
import { getRateForPair } from "@/currency/service";
import { applyDueRecurring } from "./recurring";

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
});
