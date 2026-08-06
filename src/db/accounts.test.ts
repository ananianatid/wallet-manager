import type { SQLiteDatabase } from "expo-sqlite";
import {
  getAccountBalance,
  planBalanceAdjustment,
  setAccountBalance,
} from "./accounts";

interface AccountRowLike {
  id: number;
  name: string;
  groupId: number | null;
  groupName: string | null;
  hidden: number;
  excludeFromTotal: number;
  description: string | null;
  createdAt: number;
  balance: number;
  reservedAmount: number;
  availableBalance: number;
}

interface Call {
  sql: string;
  params: unknown[];
}

function mockDb({
  account,
  existingCategoryId = null,
}: {
  account: AccountRowLike;
  existingCategoryId?: number | null;
}) {
  const calls: Call[] = [];
  let seq = 100;

  const runAsync = jest.fn(async (sql: string, ...params: unknown[]) => {
    calls.push({ sql, params });
    return { lastInsertRowId: ++seq, changes: 1 };
  });

  const getFirstAsync = jest.fn(
    async (sql: string, ...params: unknown[]) => {
      if (sql.startsWith("SELECT id FROM categories")) {
        return existingCategoryId != null ? { id: existingCategoryId } : null;
      }
      if (sql.includes("FROM accounts a")) {
        return account;
      }
      return null;
    },
  );

  const db = { runAsync, getFirstAsync } as unknown as SQLiteDatabase;
  return { db, calls };
}

describe("planBalanceAdjustment", () => {
  it("returns null when the target equals the current balance", () => {
    expect(planBalanceAdjustment(1000, 1000)).toBeNull();
  });

  it("plans an income when the target is above the balance", () => {
    expect(planBalanceAdjustment(1000, 3500)).toEqual({
      type: "income",
      amount: 2500,
    });
  });

  it("plans an expense when the target is below the balance", () => {
    expect(planBalanceAdjustment(1000, 700)).toEqual({
      type: "expense",
      amount: 300,
    });
  });

  it("supports a negative target balance", () => {
    expect(planBalanceAdjustment(500, -300)).toEqual({
      type: "expense",
      amount: 800,
    });
    expect(planBalanceAdjustment(-400, 100)).toEqual({
      type: "income",
      amount: 500,
    });
  });
});

describe("getAccountBalance", () => {
  it("keeps transfer fees included in the source debit", async () => {
    const getFirstAsync = jest.fn(async (sql: string, ...params: unknown[]) => {
      expect(sql).toContain("-(amount + COALESCE(fee, 0))");
      expect(params).toEqual([[7, 7, 7]]);
      return { balance: -12_250 };
    });
    const db = { getFirstAsync } as unknown as SQLiteDatabase;

    await expect(getAccountBalance(db, 7)).resolves.toBe(-12_250);
  });
});

describe("setAccountBalance", () => {
  const account: AccountRowLike = {
    id: 7,
    name: "Banque A",
    groupId: 1,
    groupName: "Compte courant",
    hidden: 0,
    excludeFromTotal: 0,
    description: null,
    createdAt: 1_700_000_000_000,
    balance: 1000,
    reservedAmount: 0,
    availableBalance: 1000,
  };

  it("creates an income « Équilibre » transaction when the target is higher", async () => {
    const { db, calls } = mockDb({ account, existingCategoryId: 3 });
    const report = await setAccountBalance(db, 7, 2500, 1234);

    const insert = calls.find((c) =>
      c.sql.startsWith("INSERT INTO transactions"),
    );
    expect(insert).toBeDefined();
    expect(insert!.params.slice(0, 9)).toEqual([
      "income",
      1500,
      3,
      7,
      null,
      null,
      "Équilibre",
      1234,
      expect.any(Number),
    ]);
    expect(report).toEqual({ type: "income", amount: 1500, categoryId: 3 });
  });

  it("creates an expense « Équilibre » transaction when the target is lower", async () => {
    const { db, calls } = mockDb({ account, existingCategoryId: 4 });
    await setAccountBalance(db, 7, 800, 1234);

    const insert = calls.find((c) =>
      c.sql.startsWith("INSERT INTO transactions"),
    );
    expect(insert!.params[0]).toBe("expense");
    expect(insert!.params[1]).toBe(200);
    expect(insert!.params[6]).toBe("Équilibre");
  });

  it("does nothing when the balance is unchanged", async () => {
    const { db, calls } = mockDb({ account, existingCategoryId: 3 });
    const report = await setAccountBalance(db, 7, 1000, 1234);

    expect(report).toBeNull();
    const insert = calls.find((c) =>
      c.sql.startsWith("INSERT INTO transactions"),
    );
    expect(insert).toBeUndefined();
  });

  it("recreates the « Autre » category when it is missing", async () => {
    const { db, calls } = mockDb({ account, existingCategoryId: null });
    await setAccountBalance(db, 7, 2000, 1234);

    const categoryInsert = calls.find((c) =>
      c.sql.startsWith("INSERT INTO categories"),
    );
    expect(categoryInsert).toBeDefined();
    expect(categoryInsert!.params).toEqual([
      "income",
      "Autre",
      expect.any(String),
    ]);

    const insert = calls.find((c) =>
      c.sql.startsWith("INSERT INTO transactions"),
    );
    expect(insert!.params[2]).toBe(101);
  });
});
