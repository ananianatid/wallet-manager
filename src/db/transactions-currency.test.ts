import type { SQLiteDatabase } from "expo-sqlite";
import { createTransaction } from "./transactions";

describe("multidevise transactions", () => {
  it("persists source and destination amounts with the conversion snapshot", async () => {
    const calls: unknown[][] = [];
    const db = {
      getAllAsync: jest.fn(async () => [
        { id: 1, currencyCode: "XOF" },
        { id: 2, currencyCode: "USD" },
      ]),
      runAsync: jest.fn(async (_sql: string, ...params: unknown[]) => {
        calls.push(params);
        return { lastInsertRowId: 42, changes: 1 };
      }),
    } as unknown as SQLiteDatabase;

    await createTransaction(db, {
      type: "transfer",
      amount: 10_000,
      destinationAmount: 16,
      exchangeRate: 0.0016,
      exchangeRateDate: "2026-08-06",
      exchangeRateProvider: "Frankfurter blended",
      categoryId: null,
      accountId: 1,
      destinationAccountId: 2,
      fee: 250,
      note: "Test",
      transactionDate: 1_700_000_000_000,
    });

    expect(calls[0]).toEqual([
      "transfer",
      10_000,
      null,
      1,
      2,
      250,
      "Test",
      1_700_000_000_000,
      expect.any(Number),
      16,
      0.0016,
      "2026-08-06",
      "Frankfurter blended",
    ]);
  });
});
