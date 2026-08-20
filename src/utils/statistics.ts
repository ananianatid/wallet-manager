import type { SavingsRule, Transaction, TransactionAmountRow } from "../types";
import type { CategoryIconName } from "@/constants/category-icons";

export interface MonthRef {
  year: number;
  month: number;
}

export type PeriodGranularity = "month" | "quarter" | "year" | "all";
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DEFAULT_WEEK_START_DAY: WeekStartDay = 1;

export function parseWeekStartDay(value: string | null): WeekStartDay {
  if (value == null || value.trim() === "") {
    return DEFAULT_WEEK_START_DAY;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6
    ? (parsed as WeekStartDay)
    : DEFAULT_WEEK_START_DAY;
}

export interface PeriodBounds {
  startMs: number | null;
  endMs: number | null;
}

export function getWeekBounds(
  anchorMs: number,
  weekStartDay: WeekStartDay,
): PeriodBounds {
  const anchor = new Date(anchorMs);
  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
  );
  const offset = (start.getDay() - weekStartDay + 7) % 7;
  start.setDate(start.getDate() - offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function getPeriodBounds(
  granularity: PeriodGranularity,
  cursor: MonthRef,
): PeriodBounds {
  if (granularity === "all") {
    return { startMs: null, endMs: null };
  }

  const startMonth =
    granularity === "month"
      ? cursor
      : granularity === "quarter"
        ? monthFromIndex(Math.floor(monthIndex(cursor) / 3) * 3)
        : { year: cursor.year, month: 0 };
  const endMonth =
    granularity === "month"
      ? cursor
      : granularity === "quarter"
        ? monthFromIndex(Math.floor(monthIndex(cursor) / 3) * 3 + 2)
        : { year: cursor.year, month: 11 };

  return {
    startMs: new Date(startMonth.year, startMonth.month, 1).getTime(),
    endMs: new Date(endMonth.year, endMonth.month + 1, 1).getTime(),
  };
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
  converter?: AmountConverter,
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
    entry.total += convertedAmount(t.amount, t.accountCurrencyCode, converter);
    entry.count += 1;
    byName.set(name, entry);
    grandTotal += convertedAmount(t.amount, t.accountCurrencyCode, converter);
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

export interface CategoryChange {
  categoryId: number | null;
  categoryName: string;
  categoryIcon: CategoryIconName | null;
  currentTotal: number;
  previousTotal: number;
  delta: number;
  percent: number | null;
  currentPct: number;
  previousPct: number;
}

function categoryKey(slice: CategorySlice): string {
  return slice.categoryId == null
    ? `name:${slice.categoryName}`
    : `id:${slice.categoryId}`;
}

export function categoryChanges(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
  type: "income" | "expense",
  converter?: AmountConverter,
): CategoryChange[] {
  const current = categoryBreakdown(currentTransactions, type, converter);
  const previous = categoryBreakdown(previousTransactions, type, converter);
  const currentByKey = new Map(current.map((slice) => [categoryKey(slice), slice]));
  const previousByKey = new Map(previous.map((slice) => [categoryKey(slice), slice]));
  const keys = new Set([...currentByKey.keys(), ...previousByKey.keys()]);

  return [...keys]
    .map((key) => {
      const currentSlice = currentByKey.get(key);
      const previousSlice = previousByKey.get(key);
      const currentTotal = currentSlice?.total ?? 0;
      const previousTotal = previousSlice?.total ?? 0;
      return {
        categoryId: currentSlice?.categoryId ?? previousSlice?.categoryId ?? null,
        categoryName:
          currentSlice?.categoryName ?? previousSlice?.categoryName ?? "Sans catégorie",
        categoryIcon: currentSlice?.categoryIcon ?? previousSlice?.categoryIcon ?? null,
        currentTotal,
        previousTotal,
        delta: currentTotal - previousTotal,
        percent:
          previousTotal === 0
            ? null
            : ((currentTotal - previousTotal) / previousTotal) * 100,
        currentPct: currentSlice?.pct ?? 0,
        previousPct: previousSlice?.pct ?? 0,
      } satisfies CategoryChange;
    })
    .filter((change) => change.currentTotal > 0 || change.previousTotal > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export interface Totals {
  income: number;
  expense: number;
  fees: number;
  net: number;
}

export interface ComparisonMetric {
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
}

export interface TotalsComparison {
  income: ComparisonMetric;
  expense: ComparisonMetric;
  fees: ComparisonMetric;
  net: ComparisonMetric;
}

function compareMetric(current: number, previous: number): ComparisonMetric {
  return {
    current,
    previous,
    delta: current - previous,
    percent:
      previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100,
  };
}

export function compareTotals(
  current: Totals,
  previous: Totals,
): TotalsComparison {
  return {
    income: compareMetric(current.income, previous.income),
    expense: compareMetric(current.expense, previous.expense),
    fees: compareMetric(current.fees, previous.fees),
    net: compareMetric(current.net, previous.net),
  };
}

export type AmountConverter = (amount: number, currency: string) => number | null;

function convertedAmount(
  amount: number,
  currency: string | undefined,
  converter?: AmountConverter,
): number {
  return converter ? converter(amount, currency ?? "XOF") ?? 0 : amount;
}

export function totals(
  transactions: readonly (Transaction | TransactionAmountRow)[],
  converter?: AmountConverter,
): Totals {
  let income = 0;
  let expense = 0;
  let fees = 0;
  for (const t of transactions) {
    if (t.type === "income") {
      income += convertedAmount(t.amount, t.accountCurrencyCode, converter);
    } else if (t.type === "expense") {
      expense += convertedAmount(t.amount, t.accountCurrencyCode, converter);
    } else if (t.type === "transfer" && t.fee) {
      fees += convertedAmount(t.fee, t.accountCurrencyCode, converter);
    }
  }
  return { income, expense, fees, net: income - expense - fees };
}

export interface MonthPoint extends Totals {
  year: number;
  month: number;
}

export interface DayPoint extends Totals {
  year: number;
  month: number;
  day: number;
}

export function dailySeries(
  transactions: Transaction[],
  startMs: number | null,
  endMs: number | null,
  converter?: AmountConverter,
): DayPoint[] {
  if (startMs == null || endMs == null || startMs >= endMs) {
    return [];
  }

  const byDay = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const date = new Date(transaction.transactionDate);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const rows = byDay.get(key) ?? [];
    rows.push(transaction);
    byDay.set(key, rows);
  }

  const points: DayPoint[] = [];
  const cursor = new Date(startMs);
  while (cursor.getTime() < endMs) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const day = cursor.getDate();
    const key = `${year}-${month}-${day}`;
    points.push({
      year,
      month,
      day,
      ...totals(byDay.get(key) ?? [], converter),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

export function monthlySeries(
  transactions: Transaction[],
  months: MonthRef[],
  converter?: AmountConverter,
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
    ...totals(byMonth.get(monthIndex(m)) ?? [], converter),
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
  converter?: AmountConverter,
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
      (contributions.get(rule.id) ?? 0) +
        Math.round(
          (convertedAmount(t.amount, t.accountCurrencyCode, converter) * rule.percent) / 100,
        ),
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
  converter?: AmountConverter,
): MonthlySavingsBreakdown[] {
  return months.map(({ year, month }) => {
    const startMs = new Date(year, month, 1).getTime();
    const endMs = new Date(year, month + 1, 1).getTime();
    const monthTransactions = transactions.filter(
      (transaction) =>
        transaction.transactionDate >= startMs &&
        transaction.transactionDate < endMs,
    );
    const contributions = savingsByRule(monthTransactions, rules, startMs, converter);
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
