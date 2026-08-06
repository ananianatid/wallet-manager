import type { SavingsRule, Transaction } from "../types";
import type { CategoryIconName } from "@/constants/category-icons";

export interface MonthRef {
  year: number;
  month: number;
}

export function monthIndex(ref: MonthRef): number {
  return ref.year * 12 + ref.month;
}

export function monthFromIndex(index: number): MonthRef {
  return { year: Math.floor(index / 12), month: index % 12 };
}

export function enumerateMonths(start: MonthRef, end: MonthRef): MonthRef[] {
  const months: MonthRef[] = [];
  const first = monthIndex(start);
  const last = monthIndex(end);
  for (let i = first; i <= last; i++) {
    months.push(monthFromIndex(i));
  }
  return months;
}

export interface CategorySlice {
  categoryId: number | null;
  categoryName: string;
  categoryIcon: CategoryIconName | null;
  total: number;
  count: number;
  pct: number;
}

export function categoryBreakdown(
  transactions: Transaction[],
  type: "income" | "expense",
): CategorySlice[] {
  const byName = new Map<string, { categoryId: number | null; categoryIcon: CategoryIconName | null; total: number; count: number }>();
  let grandTotal = 0;
  for (const t of transactions) {
    if (t.type !== type) {
      continue;
    }
    const name = t.categoryName ?? "Sans catégorie";
    const entry = byName.get(name) ?? {
      categoryId: t.categoryId,
      categoryIcon: t.categoryIcon,
      total: 0,
      count: 0,
    };
    entry.total += t.amount;
    entry.count += 1;
    byName.set(name, entry);
    grandTotal += t.amount;
  }
  return [...byName.entries()]
    .map(([categoryName, { categoryId, categoryIcon, total, count }]) => ({
      categoryId,
      categoryName,
      categoryIcon,
      total,
      count,
      pct: grandTotal === 0 ? 0 : (total / grandTotal) * 100,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface Totals {
  income: number;
  expense: number;
  fees: number;
  net: number;
}

export function totals(transactions: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  let fees = 0;
  for (const t of transactions) {
    if (t.type === "income") {
      income += t.amount;
    } else if (t.type === "expense") {
      expense += t.amount;
    } else if (t.type === "transfer" && t.fee) {
      fees += t.fee;
    }
  }
  return { income, expense, fees, net: income - expense - fees };
}

export interface MonthPoint extends Totals {
  year: number;
  month: number;
}

export function monthlySeries(
  transactions: Transaction[],
  months: MonthRef[],
): MonthPoint[] {
  const byMonth = new Map<number, Transaction[]>();
  for (const t of transactions) {
    const d = new Date(t.transactionDate);
    const key = monthIndex({ year: d.getFullYear(), month: d.getMonth() });
    const list = byMonth.get(key) ?? [];
    list.push(t);
    byMonth.set(key, list);
  }
  return months.map((m) => ({
    year: m.year,
    month: m.month,
    ...totals(byMonth.get(monthIndex(m)) ?? []),
  }));
}

export interface SavingsContribution {
  rule: SavingsRule;
  amount: number;
}

export interface MonthlySavingsBreakdown {
  year: number;
  month: number;
  contributions: SavingsContribution[];
  total: number;
  subtractableTotal: number;
}

export function savingsByRule(
  transactions: Transaction[],
  rules: SavingsRule[],
  periodStartMs: number,
): SavingsContribution[] {
  const specific = new Map<number, SavingsRule>();
  let global: SavingsRule | null = null;
  for (const rule of rules) {
    if (rule.categoryId == null) {
      global = rule;
    } else {
      specific.set(rule.categoryId, rule);
    }
  }

  const contributions = new Map<number, number>();
  for (const rule of rules) {
    contributions.set(rule.id, 0);
  }

  for (const t of transactions) {
    if (t.type !== "income") {
      continue;
    }
    let rule: SavingsRule | null = null;
    if (t.categoryId != null && specific.has(t.categoryId)) {
      rule = specific.get(t.categoryId)!;
    } else if (global) {
      rule = global;
    }
    if (!rule) {
      continue;
    }
    const windowStart = rule.startDate ?? periodStartMs;
    if (t.transactionDate < windowStart) {
      continue;
    }
    contributions.set(
      rule.id,
      (contributions.get(rule.id) ?? 0) + Math.round((t.amount * rule.percent) / 100),
    );
  }

  const byName = new Map<number, string>();
  for (const rule of rules) {
    byName.set(rule.id, rule.categoryName ?? "");
  }

  return [...rules]
    .sort((a, b) => {
      const an = byName.get(a.id) ?? "";
      const bn = byName.get(b.id) ?? "";
      return an.localeCompare(bn, "fr");
    })
    .map((rule) => ({
      rule,
      amount: contributions.get(rule.id) ?? 0,
    }));
}

export function monthlySavingsBreakdown(
  transactions: Transaction[],
  rules: SavingsRule[],
  months: MonthRef[],
): MonthlySavingsBreakdown[] {
  return months.map(({ year, month }) => {
    const startMs = new Date(year, month, 1).getTime();
    const endMs = new Date(year, month + 1, 1).getTime();
    const monthTransactions = transactions.filter(
      (transaction) =>
        transaction.transactionDate >= startMs &&
        transaction.transactionDate < endMs,
    );
    const contributions = savingsByRule(monthTransactions, rules, startMs);
    return {
      year,
      month,
      contributions,
      total: contributions.reduce((sum, contribution) => sum + contribution.amount, 0),
      subtractableTotal: contributions
        .filter(({ rule }) => rule.subtractFromAvailable)
        .reduce((sum, contribution) => sum + contribution.amount, 0),
    };
  });
}
