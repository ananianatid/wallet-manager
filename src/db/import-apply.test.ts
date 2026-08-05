import type { SQLiteDatabase } from "expo-sqlite";
import { applyImportPlan } from "./import-apply";
import { IMPORT_ACCOUNT_CATEGORY, type ImportPlan } from "./money-manager";

interface Call {
  sql: string;
  params: unknown[];
}

function plan(overrides: Partial<ImportPlan> = {}): ImportPlan {
  return {
    accounts: [
      { name: "Banque A", groupName: null },
      { name: "Banque B", groupName: null },
    ],
    categories: [
      { type: "account", name: IMPORT_ACCOUNT_CATEGORY },
      { type: "income", name: "Salaire" },
      { type: "expense", name: "Nourriture" },
    ],
    transactions: [
      {
        type: "income",
        amount: 100000,
        categoryName: "Salaire",
        accountName: "Banque A",
        destinationName: null,
        fee: null,
        note: null,
        date: 1_700_000_000_000,
      },
    ],
    stats: {
      accounts: 2,
      categories: 3,
      income: 1,
      expense: 0,
      transfer: 0,
      feesMerged: 0,
      feeOrphans: 0,
      rangeStart: 1_700_000_000_000,
      rangeEnd: 1_700_000_000_000,
    },
    ...overrides,
  };
}

interface MockDbOptions {
  existingAccounts?: { id: number; name: string }[];
  existingCategories?: { type: string; name: string; id: number }[];
  deletedChanges?: number;
}

function mockDb({
  existingAccounts = [],
  existingCategories = [],
  deletedChanges = 0,
}: MockDbOptions = {}) {
  const calls: Call[] = [];
  let categorySeq = 0;
  let rowSeq = 100;

  const runAsync = jest.fn(async (sql: string, ...params: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes("INSERT INTO categories")) {
      categorySeq += 1;
      return { lastInsertRowId: categorySeq, changes: 1 };
    }
    if (sql.includes("DELETE FROM categories")) {
      return { lastInsertRowId: 0, changes: deletedChanges };
    }
    rowSeq += 1;
    return { lastInsertRowId: rowSeq, changes: 1 };
  });

  const getFirstAsync = jest.fn(
    async (sql: string, ...params: unknown[]) => {
      if (sql.includes("SELECT id FROM categories")) {
        const match = existingCategories.find(
          (c) => c.type === params[0] && c.name === params[1],
        );
        return match ? { id: match.id } : null;
      }
      return null;
    },
  );

  const getAllAsync = jest.fn(async (sql: string) => {
    if (sql.includes("FROM accounts")) {
      return existingAccounts;
    }
    if (sql.includes("FROM transactions")) {
      return [];
    }
    return [];
  });

  const withTransactionAsync = jest.fn(
    async (callback: () => Promise<void>) => {
      await callback();
    },
  );

  const db = {
    runAsync,
    getFirstAsync,
    getAllAsync,
    withTransactionAsync,
  } as unknown as SQLiteDatabase;

  return { db, calls };
}

describe("applyImportPlan — account categories", () => {
  it("assigns every new account to the single generic category", async () => {
    const { db, calls } = mockDb();
    await applyImportPlan(db, plan());

    const insertAcc = calls.filter((c) =>
      c.sql.startsWith("INSERT INTO accounts"),
    );
    expect(insertAcc).toHaveLength(2);
    for (const call of insertAcc) {
      expect(call.params[1]).toBe(1);
    }
  });

  it("reassigns existing accounts to the generic category on re-import", async () => {
    const { db, calls } = mockDb({
      existingAccounts: [
        { id: 10, name: "Banque A" },
        { id: 11, name: "Banque B" },
      ],
    });
    await applyImportPlan(db, plan());

    const update = calls.find((c) =>
      c.sql.startsWith("UPDATE accounts SET category_id"),
    );
    expect(update).toBeDefined();
    expect(update!.params).toEqual([1]);

    const insertAcc = calls.filter((c) =>
      c.sql.startsWith("INSERT INTO accounts"),
    );
    expect(insertAcc).toHaveLength(0);
  });

  it("runs the reassignment before the category cleanup", async () => {
    const { db, calls } = mockDb();
    await applyImportPlan(db, plan());

    const updateIndex = calls.findIndex((c) =>
      c.sql.startsWith("UPDATE accounts SET category_id"),
    );
    const deleteIndex = calls.findIndex((c) =>
      c.sql.startsWith("DELETE FROM categories"),
    );
    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(deleteIndex).toBeGreaterThan(updateIndex);
  });

  it("does not touch account categories when the plan has no account category", async () => {
    const p = plan();
    const { db, calls } = mockDb({ existingAccounts: [{ id: 5, name: "X" }] });
    await applyImportPlan(db, {
      ...p,
      categories: p.categories.filter((c) => c.type !== "account"),
    });

    const update = calls.find((c) =>
      c.sql.startsWith("UPDATE accounts SET category_id"),
    );
    expect(update).toBeUndefined();
  });

  it("reuses an existing matching category instead of creating a duplicate", async () => {
    const { db, calls } = mockDb({
      existingCategories: [
        { type: "account", name: IMPORT_ACCOUNT_CATEGORY, id: 7 },
      ],
    });
    await applyImportPlan(db, plan());

    const update = calls.find((c) =>
      c.sql.startsWith("UPDATE accounts SET category_id"),
    );
    expect(update!.params).toEqual([7]);

    const categoryInserts = calls.filter((c) =>
      c.sql.includes("INSERT INTO categories"),
    );
    expect(categoryInserts).toHaveLength(2);
  });
});