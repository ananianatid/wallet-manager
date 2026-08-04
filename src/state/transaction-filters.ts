import { useSyncExternalStore } from "react";
import type { Transaction, TransactionType } from "@/types";

export interface TransactionFilters {
  mode: "month" | "all";
  year: number;
  month: number;
  accountIds: number[] | null;
  types: TransactionType[];
  categoryIds: number[] | null;
}

const now = new Date();
const allTypes: TransactionType[] = ["income", "expense", "transfer"];

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  mode: "month",
  year: now.getFullYear(),
  month: now.getMonth(),
  accountIds: null,
  types: allTypes,
  categoryIds: null,
};

let currentFilters = DEFAULT_TRANSACTION_FILTERS;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TransactionFilters {
  return currentFilters;
}

export function useTransactionFilters(): TransactionFilters {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setTransactionFilters(next: TransactionFilters): void {
  currentFilters = {
    ...next,
    accountIds: next.accountIds ? [...next.accountIds] : null,
    types: [...next.types],
    categoryIds: next.categoryIds ? [...next.categoryIds] : null,
  };
  listeners.forEach((listener) => listener());
}

export function resetTransactionFilters(): TransactionFilters {
  const reset = {
    ...DEFAULT_TRANSACTION_FILTERS,
    types: [...DEFAULT_TRANSACTION_FILTERS.types],
  };
  setTransactionFilters(reset);
  return reset;
}

export function filterTransactions(
  rows: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  return rows.filter((transaction) => {
    const matchesAccount =
      filters.accountIds == null ||
      filters.accountIds.includes(transaction.accountId) ||
      (transaction.destinationAccountId != null &&
        filters.accountIds.includes(transaction.destinationAccountId));
    const matchesType = filters.types.includes(transaction.type);
    const matchesCategory =
      filters.categoryIds == null ||
      (transaction.categoryId != null &&
        filters.categoryIds.includes(transaction.categoryId));

    return matchesAccount && matchesType && matchesCategory;
  });
}

export function countActiveTransactionFilters(
  filters: TransactionFilters,
): number {
  let count = 0;
  if (filters.mode === "all") count += 1;
  if (filters.accountIds != null) count += 1;
  if (filters.types.length !== allTypes.length) count += 1;
  if (filters.categoryIds != null) count += 1;
  return count;
}
