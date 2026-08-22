import { listBudgets } from "@/db/budgets";
import { getDatabase } from "@/db/database";
import { listGoals } from "@/db/goals";
import { listPendingRecurringOccurrences, listRecurring } from "@/db/recurring";
import { listSavingsRules } from "@/db/savings";
import { listTransactions } from "@/db/transactions";
import { budgetProgress, type BudgetProgressRow } from "@/utils/dashboard";
import type { Goal, RecurringOccurrence, RecurringTransaction, SavingsRule } from "@/types";

export interface PlansSnapshot {
  budgetRows: BudgetProgressRow[];
  goals: Goal[];
  savingsRules: SavingsRule[];
  recurring: RecurringTransaction[];
  pendingOccurrences: RecurringOccurrence[];
}

export type CurrencyConverter = (amount: number, fromCurrency: string, toCurrency?: string) => number | null;

export async function loadPlansSnapshot(
  baseCurrency: string,
  convert: CurrencyConverter,
): Promise<PlansSnapshot> {
  const db = await getDatabase();
  const now = new Date();
  const [budgets, goals, savingsRules, recurring, pendingOccurrences, transactions] = await Promise.all([
    listBudgets(db),
    listGoals(db),
    listSavingsRules(db),
    listRecurring(db),
    listPendingRecurringOccurrences(db),
    listTransactions(db, {
      startMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
      endMs: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(),
    }),
  ]);
  const spentByCategory = new Map<number, number>();
  let totalExpense = 0;
  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    const amount = convert(transaction.amount, transaction.accountCurrencyCode ?? baseCurrency) ?? 0;
    totalExpense += amount;
    if (transaction.categoryId != null) {
      spentByCategory.set(transaction.categoryId, (spentByCategory.get(transaction.categoryId) ?? 0) + amount);
    }
  }
  return {
    budgetRows: budgetProgress(budgets, spentByCategory, totalExpense),
    goals,
    savingsRules,
    recurring,
    pendingOccurrences,
  };
}
