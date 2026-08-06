import type { SQLiteDatabase } from "expo-sqlite";
import { calculateSafeToSpend } from "./cashflow";
import type { Goal, SavingsRule, Transaction } from "../types";

const NOW = new Date(2026, 6, 10).getTime();

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

function account(overrides: Partial<AccountRowLike> = {}): AccountRowLike {
  return {
    id: 1,
    name: "Compte",
    groupId: null,
    groupName: null,
    hidden: 0,
    excludeFromTotal: 0,
    description: null,
    createdAt: 0,
    balance: 0,
    reservedAmount: 0,
    availableBalance: 0,
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    type: "income",
    amount: 100_000,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    accountId: 1,
    accountName: "Compte",
    destinationAccountId: null,
    destinationAccountName: null,
    fee: null,
    note: null,
    transactionDate: NOW,
    createdAt: 0,
    ...overrides,
  };
}

function savingsRule(overrides: Partial<SavingsRule> = {}): SavingsRule {
  return {
    id: 1,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    percent: 10,
    subtractFromAvailable: false,
    createdAt: 0,
    startDate: null,
    ...overrides,
  };
}

function mockDb({
  accounts = [account()],
  transactions = [transaction()],
  recurring = [],
  goals = [],
  savingsRules = [],
  setting = null,
}: {
  accounts?: AccountRowLike[];
  transactions?: Transaction[];
  recurring?: unknown[];
  goals?: Goal[];
  savingsRules?: SavingsRule[];
  setting?: string | null;
}) {
  const getAllAsync = jest.fn(async (sql: string) => {
    if (sql.includes("FROM accounts")) return accounts;
    if (sql.includes("FROM transactions")) return transactions;
    if (sql.includes("FROM recurring_transactions")) return recurring;
    if (sql.includes("FROM goals")) return goals;
    if (sql.includes("FROM savings_rules")) return savingsRules;
    return [];
  });
  const getFirstAsync = jest.fn(async (sql: string, key: string) => {
    if (sql.includes("FROM settings")) {
      return key === "savings_subtract_from_available" ? { value: setting } : null;
    }
    return null;
  });
  const runAsync = jest.fn(async () => ({ lastInsertRowId: 1, changes: 0 }));
  const execAsync = jest.fn(async () => {});
  const withTransactionAsync = jest.fn(async (callback: () => Promise<void>) => {
    await callback();
  });

  const db = {
    getAllAsync,
    getFirstAsync,
    runAsync,
    execAsync,
    withTransactionAsync,
  } as unknown as SQLiteDatabase;

  return { db };
}

describe("calculateSafeToSpend", () => {
  it("ne soustrait pas une règle informative du disponible", async () => {
    const june = new Date(2026, 5, 5).getTime();
    const august = new Date(2026, 7, 1).getTime();
    const { db } = mockDb({
      transactions: [
        transaction({ id: 1, type: "income", amount: 100_000, transactionDate: june }),
        transaction({ id: 2, type: "income", amount: 100_000, transactionDate: august }),
      ],
      savingsRules: [savingsRule({ percent: 10, startDate: june })],
      setting: "1",
    });
    const result = await calculateSafeToSpend(db, NOW);
    expect(result.savings).toBe(0);
    expect(result.amount).toBe(200_000);
  });

  it("soustrait une règle activée depuis sa date de départ", async () => {
    const june = new Date(2026, 5, 5).getTime();
    const july = new Date(2026, 6, 15).getTime();
    const { db } = mockDb({
      transactions: [
        transaction({ id: 1, type: "income", amount: 100_000, transactionDate: june }),
        transaction({ id: 2, type: "income", amount: 100_000, transactionDate: july }),
      ],
      savingsRules: [savingsRule({ percent: 10, startDate: june, subtractFromAvailable: true })],
      setting: "1",
    });
    const result = await calculateSafeToSpend(db, NOW);
    expect(result.savings).toBe(20_000);
    expect(result.amount).toBe(180_000);
  });

  it("utilise le début du mois pour une règle sans date de départ", async () => {
    const july = new Date(2026, 6, 2).getTime();
    const nextMonth = new Date(2026, 7, 5).getTime();
    const { db } = mockDb({
      transactions: [
        transaction({ id: 1, type: "income", amount: 100_000, transactionDate: july }),
        transaction({ id: 2, type: "income", amount: 100_000, transactionDate: nextMonth }),
      ],
      savingsRules: [savingsRule({ percent: 10, startDate: null, subtractFromAvailable: true })],
      setting: "1",
    });
    const result = await calculateSafeToSpend(db, NOW);
    expect(result.savings).toBe(10_000);
    expect(result.amount).toBe(190_000);
  });

  it("ne compte pas les revenus au-delà du mois courant", async () => {
    const nextMonth = new Date(2026, 7, 5).getTime();
    const { db } = mockDb({
      transactions: [transaction({ id: 1, type: "income", amount: 100_000, transactionDate: nextMonth })],
      savingsRules: [savingsRule({ percent: 10, startDate: null, subtractFromAvailable: true })],
      setting: "1",
    });
    const result = await calculateSafeToSpend(db, NOW);
    expect(result.savings).toBe(0);
    expect(result.amount).toBe(100_000);
  });
});
