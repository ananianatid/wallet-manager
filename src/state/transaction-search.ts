import { useSyncExternalStore } from "react";
import type { TransactionSearchCriteria, TransactionType } from "@/types";

const ALL_TYPES: TransactionType[] = ["income", "expense", "transfer"];

export const DEFAULT_TRANSACTION_SEARCH: TransactionSearchCriteria = {
  query: "",
  startDate: null,
  endDate: null,
  minAmount: null,
  maxAmount: null,
  accountIds: null,
  types: ALL_TYPES,
  categoryIds: null,
};

let currentSearch = DEFAULT_TRANSACTION_SEARCH;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TransactionSearchCriteria {
  return currentSearch;
}

export function getTransactionSearch(): TransactionSearchCriteria {
  return currentSearch;
}

export function useTransactionSearch(): TransactionSearchCriteria {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setTransactionSearch(next: TransactionSearchCriteria): void {
  currentSearch = {
    ...next,
    types: [...next.types],
    accountIds: next.accountIds ? [...next.accountIds] : null,
    categoryIds: next.categoryIds ? [...next.categoryIds] : null,
  };
  listeners.forEach((listener) => listener());
}

export function resetTransactionSearch(): TransactionSearchCriteria {
  const reset = {
    ...DEFAULT_TRANSACTION_SEARCH,
    types: [...DEFAULT_TRANSACTION_SEARCH.types],
  };
  setTransactionSearch(reset);
  return reset;
}
