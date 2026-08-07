import type { SQLiteDatabase } from "expo-sqlite";
import { listTransactions, searchTransactions } from "./transactions";
import type { TransactionSearchCriteria } from "@/types";

function criteria(
  overrides: Partial<TransactionSearchCriteria> = {},
): TransactionSearchCriteria {
  return {
    query: "",
    startDate: null,
    endDate: null,
    minAmount: null,
    maxAmount: null,
    accountIds: null,
    types: ["income", "expense", "transfer"],
    categoryIds: null,
    ...overrides,
  };
}

describe("searchTransactions", () => {
  it("builds one parameterized AND query for every active criterion", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([]);
    const db = { getAllAsync } as unknown as SQLiteDatabase;

    await searchTransactions(
      db,
      criteria({
        query: "100% salaire",
        startDate: new Date(2026, 2, 4).getTime(),
        endDate: new Date(2026, 2, 4).getTime(),
        minAmount: 50_000,
        maxAmount: 100_000,
        accountIds: [2],
        types: ["income", "expense"],
        categoryIds: [7],
      }),
    );

    const [sql, params] = getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("t.note LIKE ? ESCAPE");
    expect(sql).toContain("t.transaction_date >= ?");
    expect(sql).toContain("t.transaction_date < ?");
    expect(sql).toContain("t.amount >= ?");
    expect(sql).toContain("t.amount <= ?");
    expect(sql).toContain("t.account_id IN");
    expect(sql).toContain("t.type IN");
    expect(sql).toContain("t.category_id IN");
    expect(sql.match(/ AND /g)?.length).toBeGreaterThanOrEqual(7);
    expect(params).toContain("%100\\% salaire%");
    expect(params).toContain(50_000);
    expect(params).toContain(100_000);
    expect(params).toContain(2);
    expect(params).toContain(7);
  });

  it("supports an empty text query and inclusive amount bounds", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([]);
    const db = { getAllAsync } as unknown as SQLiteDatabase;

    await searchTransactions(
      db,
      criteria({ minAmount: 35_000, maxAmount: 35_000 }),
    );

    const [sql, params] = getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain("t.note LIKE");
    expect(sql).toContain("t.amount >= ?");
    expect(sql).toContain("t.amount <= ?");
    expect(params).toEqual([35_000, 35_000, 200]);
  });
});

describe("listTransactions", () => {
  it("limits recent transactions in the database query", async () => {
    const getAllAsync = jest.fn().mockResolvedValue([]);
    const db = { getAllAsync } as unknown as SQLiteDatabase;

    await listTransactions(db, { order: "desc", limit: 5 });

    const [sql, params] = getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ORDER BY t.transaction_date DESC");
    expect(sql).toContain("LIMIT ?");
    expect(params).toEqual([5]);
  });

  it("rejects non-positive or non-integer limits", async () => {
    const db = { getAllAsync: jest.fn() } as unknown as SQLiteDatabase;

    expect(() => listTransactions(db, { limit: 0 })).toThrow(
      "La limite de transactions doit être un entier positif.",
    );
    expect(() => listTransactions(db, { limit: 1.5 })).toThrow(
      "La limite de transactions doit être un entier positif.",
    );
  });
});
