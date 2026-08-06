export type CategoryType = "account" | "income" | "expense";

export type { CategoryIconName } from "@/constants/category-icons";

export type TransactionType = "income" | "expense" | "transfer";

export interface TransactionSearchCriteria {
  query: string;
  startDate: number | null;
  endDate: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  accountIds: number[] | null;
  types: TransactionType[];
  categoryIds: number[] | null;
}

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Category {
  id: number;
  type: CategoryType;
  name: string;
  isSeed: boolean;
  icon: import("@/constants/category-icons").CategoryIconName | null;
}

export interface Account {
  id: number;
  name: string;
  groupId: number | null;
  groupName: string | null;
  hidden: boolean;
  excludeFromTotal: boolean;
  description: string | null;
  createdAt: number;
  balance: number;
  reservedAmount: number;
  availableBalance: number;
}

export interface AccountGroup {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: number;
  deletedAt: number | null;
  accountCount: number;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: import("@/constants/category-icons").CategoryIconName | null;
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
  icon?: import("@/constants/category-icons").CategoryIconName | null;
}

export interface CategoryUpdateInput {
  name: string;
  icon?: import("@/constants/category-icons").CategoryIconName | null;
}

export interface AccountInput {
  name: string;
  groupId: number | null;
  hidden?: boolean;
  excludeFromTotal?: boolean;
  description?: string | null;
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
  categoryIcon: import("@/constants/category-icons").CategoryIconName | null;
  amount: number;
  createdAt: number;
}

export interface RecurringTransaction {
  id: number;
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: import("@/constants/category-icons").CategoryIconName | null;
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
  categoryIcon: import("@/constants/category-icons").CategoryIconName | null;
  percent: number;
  subtractFromAvailable: boolean;
  createdAt: number;
  startDate: number | null;
}

export interface SavingsRuleInput {
  categoryId: number | null;
  percent: number;
  subtractFromAvailable: boolean;
  startDate: number | null;
}

export type GoalStatus = "active" | "closed";

export interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  targetDate: number;
  status: GoalStatus;
  createdAt: number;
  reservedAmount: number;
  remainingAmount: number;
  progressPercent: number;
  monthlyRequired: number;
  isAchieved: boolean;
  isOverdue: boolean;
}

export interface GoalInput {
  name: string;
  targetAmount: number;
  targetDate: number;
}

export interface GoalReservation {
  id: number;
  goalId: number;
  sourceAccountId: number;
  sourceAccountName: string;
  amount: number;
  note: string | null;
  reservationDate: number;
  createdAt: number;
  releasedAt: number | null;
}

export interface GoalReservationInput {
  goalId: number;
  sourceAccountId: number;
  amount: number;
  note: string | null;
  reservationDate: number;
}

export interface SafeToSpendSuggestion {
  goalId: number;
  goalName: string;
  amount: number;
}

export interface SafeToSpend {
  amount: number;
  currentAvailable: number;
  horizonDate: number;
  nextIncomeDate: number | null;
  usesFallbackHorizon: boolean;
  plannedIncome: number;
  plannedOutflows: number;
  eventCount: number;
  recurringEventCount: number;
  futureTransactionCount: number;
  savings: number;
  suggestion: SafeToSpendSuggestion | null;
}
