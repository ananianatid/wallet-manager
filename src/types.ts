export type CategoryType = "account" | "income" | "expense";

export type TransactionType = "income" | "expense" | "transfer";

export interface Category {
  id: number;
  type: CategoryType;
  name: string;
  isSeed: boolean;
}

export interface Account {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  createdAt: number;
  balance: number;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  accountId: number;
  accountName: string;
  destinationAccountId: number | null;
  destinationAccountName: string | null;
  fee: number | null;
  note: string | null;
  transactionDate: number;
  createdAt: number;
}

export interface CategoryInput {
  type: CategoryType;
  name: string;
}

export interface AccountInput {
  name: string;
  categoryId: number;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  accountId: number;
  destinationAccountId: number | null;
  fee: number | null;
  note: string | null;
  transactionDate: number;
}
