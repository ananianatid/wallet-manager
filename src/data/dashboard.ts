import { listBudgets } from "@/db/budgets";
import {
  calculateSafeToSpendFromInputs,
  loadSafeToSpendInputs,
} from "@/db/cashflow";
import { getDatabase } from "@/db/database";
import { savingsByRule } from "@/utils/statistics";
import type { CurrencyRate } from "@/currency/service";

export interface DashboardSnapshot {
  safeToSpend: ReturnType<typeof calculateSafeToSpendFromInputs>;
  accounts: Awaited<ReturnType<typeof loadSafeToSpendInputs>>["accountsRows"];
  goals: Awaited<ReturnType<typeof loadSafeToSpendInputs>>["goals"];
  budgets: Awaited<ReturnType<typeof listBudgets>>;
  savingsRules: Awaited<ReturnType<typeof loadSafeToSpendInputs>>["savingsRules"];
  monthTx: Awaited<ReturnType<typeof loadSafeToSpendInputs>>["transactions"];
  previousMonthTx: Awaited<ReturnType<typeof loadSafeToSpendInputs>>["transactions"];
  recent: Awaited<ReturnType<typeof loadSafeToSpendInputs>>["transactions"];
  upcoming: Awaited<ReturnType<typeof loadSafeToSpendInputs>>["transactions"];
  savingsTotal: number;
}

export type CurrencyConverter = (
  amount: number,
  fromCurrency: string,
  toCurrency?: string,
) => number | null;

export async function loadDashboardSnapshot(
  baseCurrency: string,
  rates: CurrencyRate[],
  convert: CurrencyConverter,
): Promise<DashboardSnapshot> {
  const db = await getDatabase();
  const now = new Date();
  const nowMs = now.getTime();
  const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const endMs = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const [inputs, budgets] = await Promise.all([
    loadSafeToSpendInputs(db, nowMs, {
      referenceCurrency: baseCurrency,
      currencyRates: rates,
    }),
    listBudgets(db),
  ]);
  const allTransactions = [...inputs.transactions].reverse();
  const monthTx = inputs.transactions.filter(
    (transaction) => transaction.transactionDate >= startMs && transaction.transactionDate < endMs,
  ).reverse();
  const previousMonthTx = inputs.transactions.filter(
    (transaction) => transaction.transactionDate >= previousMonthStart && transaction.transactionDate < startMs,
  ).reverse();
  const recent = inputs.transactions.filter((transaction) => transaction.transactionDate < nowMs).slice(0, 5);
  const upcoming = inputs.transactions.filter((transaction) => transaction.transactionDate >= nowMs).reverse().slice(0, 3);
  const savingsTotal = savingsByRule(allTransactions, inputs.savingsRules, 0, convert).reduce(
    (sum, contribution) => sum + contribution.amount,
    0,
  );
  return {
    safeToSpend: calculateSafeToSpendFromInputs(inputs, nowMs),
    accounts: inputs.accountsRows,
    goals: inputs.goals,
    budgets,
    savingsRules: inputs.savingsRules,
    monthTx,
    previousMonthTx,
    recent,
    upcoming,
    savingsTotal,
  };
}
