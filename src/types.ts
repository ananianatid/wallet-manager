export type CategoryType = "account" | "income" | "expense";

export type TransactionType = "income" | "expense" | "transfer";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

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
  hidden: boolean;
  excludeFromTotal: boolean;
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
  hidden?: boolean;
  excludeFromTotal?: boolean;
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

export interface Budget {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  amount: number;
  createdAt: number;
}

export interface RecurringTransaction {
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
  frequency: Frequency;
  interval: number;
  startDate: number;
  nextDate: number;
  endDate: number | null;
  isActive: boolean;
  createdAt: number;
}

export interface RecurringTransactionInput {
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  accountId: number;
  destinationAccountId: number | null;
  fee: number | null;
  note: string | null;
  frequency: Frequency;
  interval: number;
  startDate: number;
  nextDate: number;
  endDate: number | null;
  isActive: boolean;
}

export interface SavingsRule {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  percent: number;
  createdAt: number;
}

export interface SavingsRuleInput {
  categoryId: number | null;
  percent: number;
}
