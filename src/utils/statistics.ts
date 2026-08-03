import type { Transaction } from "../types";

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
  categoryName: string;
  total: number;
  count: number;
  pct: number;
}

export function expenseByCategory(
  transactions: Transaction[],
): CategorySlice[] {
  const byName = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;
  for (const t of transactions) {
    if (t.type !== "expense") {
      continue;
    }
    const name = t.categoryName ?? "Sans catégorie";
    const entry = byName.get(name) ?? { total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    byName.set(name, entry);
    grandTotal += t.amount;
  }
  return [...byName.entries()]
    .map(([categoryName, { total, count }]) => ({
      categoryName,
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
