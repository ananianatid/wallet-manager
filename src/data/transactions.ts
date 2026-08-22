import { listAccounts, listAccountsByUsage } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { listCategories, listCategoriesByUsage } from "@/db/categories";
import { applyDueRecurring, listPendingRecurringOccurrences } from "@/db/recurring";
import { getSetting, setSetting } from "@/db/settings";
import { deleteTransaction, getTransactionDetail, listTransactionAmountRows, listTransactions, searchTransactions } from "@/db/transactions";
import { listGoals } from "@/db/goals";
import { schedulePendingRecurringNotifications } from "@/services/recurring-notifications";
import type { Transaction, TransactionSearchCriteria } from "@/types";
import { totals } from "@/utils/statistics";

export type CurrencyConverter = (amount: number, fromCurrency: string, toCurrency?: string) => number | null;

export async function loadTransactionsSnapshot(
  filters: { mode: "month" | "all"; year: number; month: number; accountIds: number[] | null; types: TransactionSearchCriteria["types"]; categoryIds: number[] | null },
  convert: CurrencyConverter,
) {
  const db = await getDatabase();
  const startMs = filters.mode === "month" ? new Date(filters.year, filters.month, 1).getTime() : null;
  const endMs = filters.mode === "month" ? new Date(filters.year, filters.month + 1, 1).getTime() : null;
  const hasDisplayFilters = filters.accountIds != null || filters.types.length !== 3 || filters.categoryIds != null;
  const [transactions, accounts, summaryRows] = await Promise.all([
    listTransactions(db, { startMs, endMs, accountIds: filters.accountIds, types: filters.types, categoryIds: filters.categoryIds, order: "desc" }),
    listAccounts(db),
    hasDisplayFilters ? listTransactionAmountRows(db, { startMs, endMs }) : Promise.resolve(null),
  ]);
  return { transactions, accounts, monthTotals: totals(summaryRows ?? transactions, convert) };
}

export async function checkRecurringForToday(): Promise<number> {
  const db = await getDatabase();
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const lastCheck = await getSetting(db, "recurring_last_check");
  if (lastCheck !== String(todayKey)) {
    await applyDueRecurring(db, Date.now());
    await schedulePendingRecurringNotifications(db);
    await setSetting(db, "recurring_last_check", String(todayKey));
  }
  return (await listPendingRecurringOccurrences(db)).length;
}

export async function loadTransactionSearchOptions() {
  const db = await getDatabase();
  const [accounts, categories] = await Promise.all([listAccountsByUsage(db), listCategories(db)]);
  return {
    accounts: accounts.filter((account) => !account.hidden),
    categories: categories.filter((category) => category.type !== "account"),
  };
}

export function searchLocalTransactions(criteria: TransactionSearchCriteria): Promise<Transaction[]> {
  return getDatabase().then((db) => searchTransactions(db, criteria));
}

export async function refreshTransactionsFromCloudIfConfigured(): Promise<void> {
  const db = await getDatabase();
  if ((await getSetting(db, "cloud_sync_cursor")) === null) return;
  const sync = await import("@/cloud/sync");
  await sync.runSync(db).catch(() => {});
}

export async function loadTransactionEditor(transactionId: number | null) {
  const db = await getDatabase();
  const [accounts, categories, goals, detail] = await Promise.all([
    listAccountsByUsage(db),
    listCategoriesByUsage(db),
    listGoals(db),
    transactionId ? getTransactionDetail(db, transactionId) : Promise.resolve(null),
  ]);
  return { accounts, categories, goals, detail };
}

export async function deleteLocalTransaction(transactionId: number): Promise<void> {
  await deleteTransaction(await getDatabase(), transactionId);
}
