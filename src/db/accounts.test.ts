import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  deleteAccount,
  getAccountBalance,
  planBalanceAdjustment,
  restoreAccount,
  setAccountBalance,
  updateAccountForOnboarding,
} from "./accounts";
import { SCHEMA_VERSION_1 } from "./schema";

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

describe("updateAccountForOnboarding", () => {
  it("permet de corriger le nom et la devise avant le premier mouvement", async () => {
    const db = new SqliteDb();
    db.db.exec(SCHEMA_VERSION_1);
    db.db.exec(`
      INSERT INTO categories (id, type, name, is_seed) VALUES (1, 'account', 'Compte', 1);
      INSERT INTO accounts (id, name, category_id, created_at) VALUES (1, 'Ancien nom', 1, 1);
    `);

    await updateAccountForOnboarding(db as unknown as SQLiteDatabase, 1, {
      name: "  Compte principal  ",
      currencyCode: "usd",
    });

    expect(db.db.prepare("SELECT name, currency_code AS currencyCode FROM accounts WHERE id = 1").get()).toEqual({
      name: "Compte principal",
      currencyCode: "USD",
    });
  });

  it("refuse de changer la devise après une transaction", async () => {
    const db = new SqliteDb();
    db.db.exec(SCHEMA_VERSION_1);
    db.db.exec(`
      INSERT INTO categories (id, type, name, is_seed) VALUES (1, 'account', 'Compte', 1);
      INSERT INTO accounts (id, name, category_id, created_at) VALUES (1, 'Compte principal', 1, 1);
      INSERT INTO transactions (type, amount, account_id, transaction_date, created_at)
        VALUES ('income', 100, 1, 1, 1);
    `);

    await expect(
      updateAccountForOnboarding(db as unknown as SQLiteDatabase, 1, {
        name: "Compte principal",
        currencyCode: "USD",
      }),
    ).rejects.toThrow("ne peut plus être modifiée");
    expect(db.db.prepare("SELECT currency_code AS currencyCode FROM accounts WHERE id = 1").get()).toEqual({
      currencyCode: "XOF",
    });
  });
});

class SqliteDb {
  db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(":memory:");
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: SQLInputValue[]): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.db.prepare(sql).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getFirstAsync<T>(sql: string, ...params: SQLInputValue[]): Promise<T | null> {
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec("BEGIN");
    try {
      await task();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}

describe("deleteAccount", () => {
  const NOW = 1_700_000_000_000;

  function buildDb(): SqliteDb {
    const db = new SqliteDb();
    db.db.exec(SCHEMA_VERSION_1);
    db.db.exec(`
      INSERT INTO categories (id, type, name, is_seed, icon) VALUES
        (1, 'account', 'Banque', 1, NULL),
        (2, 'income', 'Salaire', 1, 'tag');
      INSERT INTO accounts (id, name, category_id, created_at) VALUES
        (1, 'Compte A', 1, ${NOW}),
        (2, 'Compte B', 1, ${NOW});
      INSERT INTO recurring_transactions
        (id, type, amount, category_id, account_id, destination_account_id, fee, note,
         frequency, interval, start_date, next_date, end_date, is_active, created_at)
      VALUES
        (1, 'expense', 5000, 2, 1, NULL, NULL, NULL, 'monthly', 1, ${NOW}, ${NOW}, NULL, 1, ${NOW}),
        (2, 'transfer', 10000, NULL, 2, 1, NULL, NULL, 'monthly', 1, ${NOW}, ${NOW}, NULL, 1, ${NOW}),
        (3, 'expense', 7000, 2, 2, NULL, NULL, NULL, 'weekly', 1, ${NOW}, ${NOW}, NULL, 1, ${NOW});
      INSERT INTO goals (id, name, target_amount, target_date, status, created_at)
        VALUES (1, 'Objectif A', 100000, ${NOW + 86_400_000}, 'active', ${NOW});
    `);
    return db;
  }

  function deletedAt(db: SqliteDb, id: number): number | null {
    const row = db.db.prepare("SELECT deleted_at FROM accounts WHERE id = ?").get(id) as {
      deleted_at: number | null;
    };
    return row.deleted_at;
  }

  function recurringActive(db: SqliteDb, id: number): number {
    const row = db.db
      .prepare("SELECT is_active FROM recurring_transactions WHERE id = ?")
      .get(id) as { is_active: number };
    return row.is_active;
  }

  it("bloque la suppression tant qu'une réservation d'objectif est active", async () => {
    const db = buildDb();
    db.db.exec(`
      INSERT INTO goal_reservations (goal_id, source_account_id, amount, reservation_date, created_at)
        VALUES (1, 1, 5000, ${NOW}, ${NOW});
    `);
    await expect(
      deleteAccount(db as unknown as SQLiteDatabase, 1),
    ).rejects.toThrow("Libérez d'abord les réservations");
    expect(deletedAt(db, 1)).toBeNull();
    expect(recurringActive(db, 1)).toBe(1);
  });

  it("n'est pas bloquée par des réservations déjà libérées", async () => {
    const db = buildDb();
    db.db.exec(`
      INSERT INTO goal_reservations (goal_id, source_account_id, amount, reservation_date, created_at, released_at)
        VALUES (1, 1, 5000, ${NOW}, ${NOW}, ${NOW});
    `);
    await deleteAccount(db as unknown as SQLiteDatabase, 1);
    expect(deletedAt(db, 1)).not.toBeNull();
  });

  it("désactive les transactions récurrentes source et destination du compte", async () => {
    const db = buildDb();
    await deleteAccount(db as unknown as SQLiteDatabase, 1);
    expect(deletedAt(db, 1)).not.toBeNull();
    expect(recurringActive(db, 1)).toBe(0);
    expect(recurringActive(db, 2)).toBe(0);
    expect(recurringActive(db, 3)).toBe(1);
  });

  it("reste sans effet sur un compte déjà supprimé", async () => {
    const db = buildDb();
    await deleteAccount(db as unknown as SQLiteDatabase, 1);
    const first = deletedAt(db, 1);
    await deleteAccount(db as unknown as SQLiteDatabase, 1);
    expect(deletedAt(db, 1)).toBe(first);
  });
});

describe("restoreAccount", () => {
  it("ne réactive pas les transactions récurrentes désactivées", async () => {
    const db = new SqliteDb();
    db.db.exec(SCHEMA_VERSION_1);
    const now = Date.now();
    db.db.exec(`
      INSERT INTO categories (id, type, name, is_seed, icon) VALUES
        (1, 'account', 'Banque', 1, NULL);
      INSERT INTO accounts (id, name, category_id, created_at, deleted_at) VALUES
        (1, 'Compte A', 1, ${now}, ${now});
      INSERT INTO recurring_transactions
        (id, type, amount, category_id, account_id, destination_account_id, fee, note,
         frequency, interval, start_date, next_date, end_date, is_active, created_at)
      VALUES
        (1, 'expense', 5000, 1, 1, NULL, NULL, NULL, 'monthly', 1, ${now}, ${now}, NULL, 0, ${now});
    `);
    await restoreAccount(db as unknown as SQLiteDatabase, 1);
    const row = db.db
      .prepare("SELECT deleted_at FROM accounts WHERE id = 1")
      .get() as { deleted_at: number | null };
    expect(row.deleted_at).toBeNull();
    const recurring = db.db
      .prepare("SELECT is_active FROM recurring_transactions WHERE id = 1")
      .get() as { is_active: number };
    expect(recurring.is_active).toBe(0);
  });
});
