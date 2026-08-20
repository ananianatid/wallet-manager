import type { SQLiteDatabase } from "expo-sqlite";
import { normalizeCategoryIcon } from "@/constants/category-icons";
import { convertMinorAmount } from "@/currency/currencies";
import { getRateForPair, type CurrencyRate } from "@/currency/service";
import type { Budget, BudgetPeriodSnapshot, BudgetPlan } from "../types";

interface BudgetPlanRow {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  amount: number;
  currencyCode: string;
  rolloverEnabled: number;
  isActive: number;
  createdAt: number;
}

interface SpendTransactionRow {
  id: number;
  amount: number;
  categoryId: number | null;
  currencyCode: string;
}

interface SpendSplitRow {
  transactionId: number;
  categoryId: number;
  amount: number;
  currencyCode: string;
}

const PLAN_SELECT = `
  SELECT bp.id,
         bp.category_id AS categoryId,
         c.name AS categoryName,
         c.icon AS categoryIcon,
         bp.amount,
         bp.currency_code AS currencyCode,
         bp.rollover_enabled AS rolloverEnabled,
         bp.is_active AS isActive,
         bp.created_at AS createdAt
  FROM budget_plans bp
  LEFT JOIN categories c ON c.id = bp.category_id
`;

function mapBudgetPlan(row: BudgetPlanRow): BudgetPlan {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryIcon: row.categoryName ? normalizeCategoryIcon(row.categoryIcon) : null,
    amount: row.amount,
    currencyCode: row.currencyCode,
    rolloverEnabled: row.rolloverEnabled !== 0,
    isActive: row.isActive !== 0,
    createdAt: row.createdAt,
  };
}

function mapLegacyBudget(plan: BudgetPlan): Budget {
  return {
    id: plan.id,
    categoryId: plan.categoryId,
    categoryName: plan.categoryName,
    categoryIcon: plan.categoryIcon,
    amount: plan.amount,
    currencyCode: plan.currencyCode,
    createdAt: plan.createdAt,
  };
}

async function withTransaction<T>(
  db: SQLiteDatabase,
  action: () => Promise<T>,
): Promise<T> {
  if (typeof db.withTransactionAsync === "function") {
    let result!: T;
    await db.withTransactionAsync(async () => {
      result = await action();
    });
    return result;
  }
  return action();
}

function assertPositiveAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Le montant du budget doit être un entier positif.");
  }
}

function normalizeMonth(month: string | Date): string {
  if (month instanceof Date) {
    if (!Number.isFinite(month.getTime())) {
      throw new Error("Le mois du budget est invalide.");
    }
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Le mois du budget doit respecter le format AAAA-MM.");
  }
  return month;
}

function monthStart(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1);
}

function shiftMonth(month: string, offset: number): string {
  const date = monthStart(month);
  date.setMonth(date.getMonth() + offset);
  return normalizeMonth(date);
}

function monthRange(month: string): { start: number; end: number } {
  const start = monthStart(month);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start: start.getTime(), end: end.getTime() };
}

function isBeforeMonth(left: string, right: string): boolean {
  return left < right;
}

function createdMonth(createdAt: number): string {
  return normalizeMonth(new Date(createdAt));
}

async function getActivePlan(
  db: SQLiteDatabase,
  categoryId: number | null,
): Promise<BudgetPlanRow | null> {
  return db.getFirstAsync<BudgetPlanRow>(
    `${PLAN_SELECT}
     WHERE bp.is_active = 1
       AND ((bp.category_id = ?) OR (bp.category_id IS NULL AND ? IS NULL))
     LIMIT 1`,
    categoryId,
    categoryId,
  );
}

async function syncLegacyBudget(
  db: SQLiteDatabase,
  categoryId: number | null,
  amount: number,
  currencyCode: string,
  createdAt: number,
): Promise<void> {
  const existing = await db.getFirstAsync<{ id: number }>(
    categoryId == null
      ? "SELECT id FROM budgets WHERE category_id IS NULL ORDER BY id DESC LIMIT 1"
      : "SELECT id FROM budgets WHERE category_id = ? LIMIT 1",
    ...(categoryId == null ? [] : [categoryId]),
  );
  if (existing) {
    await db.runAsync(
      "UPDATE budgets SET amount = ?, currency_code = ? WHERE id = ?",
      amount,
      currencyCode,
      existing.id,
    );
    return;
  }
  await db.runAsync(
    "INSERT INTO budgets (category_id, amount, currency_code, created_at) VALUES (?, ?, ?, ?)",
    categoryId,
    amount,
    currencyCode,
    createdAt,
  );
}

export async function listBudgetPlans(
  db: SQLiteDatabase,
  options: { includeInactive?: boolean } = {},
): Promise<BudgetPlan[]> {
  const where = options.includeInactive ? "" : "WHERE bp.is_active = 1";
  const rows = await db.getAllAsync<BudgetPlanRow>(
    `${PLAN_SELECT}
     ${where}
     ORDER BY c.name IS NULL DESC, c.name, bp.id`,
  );
  return rows.map(mapBudgetPlan);
}

export async function setBudgetPlan(
  db: SQLiteDatabase,
  categoryId: number | null,
  amount: number,
  currencyCode = "XOF",
  rolloverEnabled?: boolean,
): Promise<number> {
  assertPositiveAmount(amount);
  const now = Date.now();
  return withTransaction(db, async () => {
    const existing = await getActivePlan(db, categoryId);
    const nextRollover = rolloverEnabled ?? (existing?.rolloverEnabled !== 0);
    let planId: number;
    if (existing) {
      planId = existing.id;
      await db.runAsync(
        `UPDATE budget_plans
         SET amount = ?, currency_code = ?, rollover_enabled = ?
         WHERE id = ?`,
        amount,
        currencyCode,
        nextRollover ? 1 : 0,
        planId,
      );
    } else {
      const result = await db.runAsync(
        `INSERT INTO budget_plans
           (category_id, amount, currency_code, rollover_enabled, is_active, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        categoryId,
        amount,
        currencyCode,
        nextRollover ? 1 : 0,
        now,
      );
      planId = Number(result.lastInsertRowId);
    }
    await syncLegacyBudget(db, categoryId, amount, currencyCode, existing?.createdAt ?? now);
    return planId;
  });
}

export async function setBudgetPeriodAmount(
  db: SQLiteDatabase,
  planId: number,
  monthInput: string | Date,
  amount: number | null,
): Promise<void> {
  const month = normalizeMonth(monthInput);
  if (amount != null) {
    assertPositiveAmount(amount);
  }
  const plan = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM budget_plans WHERE id = ? AND is_active = 1",
    planId,
  );
  if (!plan) {
    throw new Error("Le budget demandé est introuvable.");
  }
  if (amount == null) {
    await db.runAsync(
      "DELETE FROM budget_periods WHERE plan_id = ? AND month = ?",
      planId,
      month,
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO budget_periods (plan_id, month, amount, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(plan_id, month) DO UPDATE SET amount = excluded.amount`,
    planId,
    month,
    amount,
    Date.now(),
  );
}

export async function listBudgets(db: SQLiteDatabase): Promise<Budget[]> {
  const plans = await listBudgetPlans(db);
  return plans.map(mapLegacyBudget);
}

export async function setBudget(
  db: SQLiteDatabase,
  categoryId: number | null,
  amount: number,
  currencyCode = "XOF",
): Promise<void> {
  await setBudgetPlan(db, categoryId, amount, currencyCode);
}

export async function deleteBudgetPlan(
  db: SQLiteDatabase,
  planId: number,
): Promise<void> {
  await withTransaction(db, async () => {
    const plan = await db.getFirstAsync<{ categoryId: number | null }>(
      "SELECT category_id AS categoryId FROM budget_plans WHERE id = ?",
      planId,
    );
    if (!plan) return;
    await db.runAsync("DELETE FROM budget_plans WHERE id = ?", planId);
    await db.runAsync(
      plan.categoryId == null
        ? "DELETE FROM budgets WHERE category_id IS NULL"
        : "DELETE FROM budgets WHERE category_id = ?",
      ...(plan.categoryId == null ? [] : [plan.categoryId]),
    );
  });
}

export async function deleteBudget(db: SQLiteDatabase, id: number): Promise<void> {
  await deleteBudgetPlan(db, id);
}

async function getPlanAmountForMonth(
  db: SQLiteDatabase,
  plan: BudgetPlan,
  month: string,
): Promise<number> {
  const override = await db.getFirstAsync<{ amount: number }>(
    "SELECT amount FROM budget_periods WHERE plan_id = ? AND month = ?",
    plan.id,
    month,
  );
  return override?.amount ?? plan.amount;
}

async function getSpent(
  db: SQLiteDatabase,
  plan: BudgetPlan,
  month: string,
  rates: Map<string, CurrencyRate | null>,
): Promise<number> {
  const { start, end } = monthRange(month);
  const transactions = await db.getAllAsync<SpendTransactionRow>(
    `SELECT t.id,
            t.amount,
            t.category_id AS categoryId,
            a.currency_code AS currencyCode
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id AND a.deleted_at IS NULL
     WHERE t.type = 'expense'
       AND t.transaction_date >= ?
       AND t.transaction_date < ?`,
    start,
    end,
  );
  if (plan.categoryId == null) {
    return sumConverted(db, transactions.map((row) => ({ amount: row.amount, currencyCode: row.currencyCode })), plan.currencyCode, rates);
  }

  const splits = await db.getAllAsync<SpendSplitRow>(
    `SELECT s.transaction_id AS transactionId,
            s.category_id AS categoryId,
            s.amount,
            a.currency_code AS currencyCode
     FROM transaction_splits s
     JOIN transactions t ON t.id = s.transaction_id AND t.type = 'expense'
     JOIN accounts a ON a.id = t.account_id AND a.deleted_at IS NULL
     WHERE s.category_id = ?
       AND t.transaction_date >= ?
       AND t.transaction_date < ?`,
    plan.categoryId,
    start,
    end,
  );
  const splitTransactionIds = new Set<number>();
  for (const split of splits) splitTransactionIds.add(split.transactionId);
  const matching = [
    ...splits.map((split) => ({ amount: split.amount, currencyCode: split.currencyCode })),
    ...transactions
      .filter((transaction) => !splitTransactionIds.has(transaction.id) && transaction.categoryId === plan.categoryId)
      .map((transaction) => ({ amount: transaction.amount, currencyCode: transaction.currencyCode })),
  ];
  return sumConverted(db, matching, plan.currencyCode, rates);
}

async function sumConverted(
  db: SQLiteDatabase,
  rows: { amount: number; currencyCode: string }[],
  targetCurrency: string,
  rates: Map<string, CurrencyRate | null>,
): Promise<number> {
  let total = 0;
  for (const row of rows) {
    if (row.currencyCode === targetCurrency) {
      total += row.amount;
      continue;
    }
    let rate = rates.get(`${row.currencyCode}:${targetCurrency}`);
    if (rate === undefined) {
      rate = await getRateForPair(db, row.currencyCode, targetCurrency);
      rates.set(`${row.currencyCode}:${targetCurrency}`, rate);
    }
    if (!rate) {
      throw new Error(`Conversion indisponible pour ${row.currencyCode}/${targetCurrency}.`);
    }
    total += convertMinorAmount(row.amount, row.currencyCode, targetCurrency, rate.rate);
  }
  return total;
}

async function calculateSnapshot(
  db: SQLiteDatabase,
  plan: BudgetPlan,
  month: string,
  rates: Map<string, CurrencyRate | null>,
  memo: Map<string, BudgetPeriodSnapshot>,
): Promise<BudgetPeriodSnapshot> {
  const key = `${plan.id}:${month}`;
  const cached = memo.get(key);
  if (cached) return cached;
  const firstMonth = createdMonth(plan.createdAt);
  if (isBeforeMonth(month, firstMonth)) {
    const empty: BudgetPeriodSnapshot = {
      planId: plan.id,
      categoryId: plan.categoryId,
      categoryName: plan.categoryName,
      categoryIcon: plan.categoryIcon,
      month,
      currencyCode: plan.currencyCode,
      plannedAmount: 0,
      rolloverIn: 0,
      spent: 0,
      available: 0,
      rolloverOut: 0,
    };
    memo.set(key, empty);
    return empty;
  }

  const plannedAmount = await getPlanAmountForMonth(db, plan, month);
  const spent = await getSpent(db, plan, month, rates);
  let rolloverIn = 0;
  if (plan.rolloverEnabled) {
    rolloverIn = (await calculateSnapshot(db, plan, shiftMonth(month, -1), rates, memo)).rolloverOut;
  }
  const available = plannedAmount + rolloverIn - spent;
  const snapshot: BudgetPeriodSnapshot = {
    planId: plan.id,
    categoryId: plan.categoryId,
    categoryName: plan.categoryName,
    categoryIcon: plan.categoryIcon,
    month,
    currencyCode: plan.currencyCode,
    plannedAmount,
    rolloverIn,
    spent,
    available,
    rolloverOut: plan.rolloverEnabled ? available : 0,
  };
  memo.set(key, snapshot);
  return snapshot;
}

export async function getBudgetSnapshot(
  db: SQLiteDatabase,
  monthInput: string | Date,
): Promise<BudgetPeriodSnapshot[]> {
  const month = normalizeMonth(monthInput);
  const plans = await listBudgetPlans(db);
  const rates = new Map<string, CurrencyRate | null>();
  const memo = new Map<string, BudgetPeriodSnapshot>();
  return Promise.all(plans.map((plan) => calculateSnapshot(db, plan, month, rates, memo)));
}
