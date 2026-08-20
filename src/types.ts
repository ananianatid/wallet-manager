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
  tagIds?: number[] | null;
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
  currencyCode: string;
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
  accountCurrencyCode?: string;
  destinationAccountId: number | null;
  destinationAccountName: string | null;
  destinationCurrencyCode?: string | null;
  fee: number | null;
  destinationAmount?: number | null;
  exchangeRate?: number | null;
  exchangeRateDate?: string | null;
  exchangeRateProvider?: string | null;
  note: string | null;
  merchant?: string | null;
  tags?: Tag[];
  transactionDate: number;
  createdAt: number;
}

export interface Tag {
  id: number;
  name: string;
  createdAt: number;
}

export interface TransactionAttachment {
  id: number;
  transactionId: number;
  originalName: string;
  mimeType: string;
  storagePath: string;
  size: number;
  createdAt: number;
  exists: boolean;
}

export interface TransactionSplit {
  id: number;
  transactionId: number;
  categoryId: number;
  categoryName: string | null;
  amount: number;
  createdAt: number;
}

export interface TransactionSplitInput {
  categoryId: number;
  amount: number;
}

export type ReimbursementDirection = "owed_to_me" | "i_owe";

export interface Person {
  id: number;
  name: string;
  createdAt: number;
}

export interface PersonInput {
  name: string;
}

export interface ReimbursementSettlement {
  id: number;
  reimbursementId: number;
  settlementTransactionId: number;
  amount: number;
  createdAt: number;
}

export interface Reimbursement {
  id: number;
  transactionId: number;
  personId: number;
  personName: string;
  direction: ReimbursementDirection;
  amount: number;
  settledAmount: number;
  remainingAmount: number;
  note: string | null;
  createdAt: number;
  settlements: ReimbursementSettlement[];
}

export interface ReimbursementInput {
  personId?: number | null;
  personName?: string | null;
  direction: ReimbursementDirection;
  amount: number;
  note?: string | null;
}

export interface TransactionDetail {
  transaction: Transaction;
  splits: TransactionSplit[];
  reimbursements: Reimbursement[];
  tags: Tag[];
}

export interface TransactionAmountRow {
  type: TransactionType;
  amount: number;
  fee: number | null;
  accountCurrencyCode: string;
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
  currencyCode?: string;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  accountId: number;
  destinationAccountId: number | null;
  fee: number | null;
  destinationAmount?: number | null;
  exchangeRate?: number | null;
  exchangeRateDate?: string | null;
  exchangeRateProvider?: string | null;
  note: string | null;
  transactionDate: number;
  merchant?: string | null;
  tags?: string[];
  allocations?: TransactionSplitInput[];
  reimbursements?: ReimbursementInput[];
}

export interface CsvImportMapping {
  date: string;
  amount: string;
  type?: string;
  merchant?: string;
  description?: string;
  note?: string;
  category?: string;
  tags?: string;
  sourceAccount?: string;
  destinationAccount?: string;
}

export interface CsvRowIssue {
  rowNumber: number;
  code: "missing_required" | "invalid_date" | "invalid_amount" | "invalid_type" | "transfer_accounts" | "unknown_category";
  message: string;
  severity: "error" | "warning";
}

export interface CsvParsedRow {
  rowNumber: number;
  date: number | null;
  amount: number | null;
  type: TransactionType | null;
  merchant: string | null;
  note: string | null;
  categoryName: string | null;
  tags: string[];
  sourceAccountName: string | null;
  destinationAccountName: string | null;
}

export interface CsvImportPreview {
  rowNumber: number;
  values: Record<string, string>;
  parsed: CsvParsedRow | null;
  issues: CsvRowIssue[];
  probableDuplicate: boolean;
  selected: boolean;
  fingerprint: string;
}

export interface ImportBatch {
  id: number;
  fingerprint: string;
  sourceName: string | null;
  rowCount: number;
  createdAt: number;
}

export interface CsvImportReport {
  batchId: number;
  totalRows: number;
  inserted: number;
  skipped: number;
  duplicates: number;
  invalidRows: number;
  unknownCategories: string[];
}

export interface Budget {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: import("@/constants/category-icons").CategoryIconName | null;
  amount: number;
  currencyCode: string;
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
  sourceCurrencyCode: string;
  destinationCurrencyCode: string | null;
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
  description?: string | null;
  imageUri?: string | null;
  linkUrl?: string | null;
  targetAmount: number;
  currencyCode: string;
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
  description?: string | null;
  imageUri?: string | null;
  linkUrl?: string | null;
  targetAmount: number;
  targetDate: number;
  currencyCode?: string;
}

export interface GoalReservation {
  id: number;
  goalId: number;
  sourceAccountId: number;
  sourceAccountName: string;
  sourceCurrencyCode?: string;
  amount: number;
  referenceAmount: number;
  referenceCurrency: string;
  exchangeRate: number;
  exchangeRateDate: string | null;
  exchangeRateProvider: string | null;
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
  referenceAmount?: number;
  referenceCurrency?: string;
  exchangeRate?: number;
  exchangeRateDate?: string | null;
  exchangeRateProvider?: string | null;
}

export interface SafeToSpendSuggestion {
  goalId: number;
  goalName: string;
  amount: number;
}

export interface SafeToSpend {
  amount: number;
  balanceBeforeCalculation: number;
  currentAvailable: number;
  includedAccountCount: number;
  excludedAccountCount: number;
  horizonDate: number;
  nextIncomeDate: number | null;
  usesFallbackHorizon: boolean;
  plannedIncome: number;
  plannedOutflows: number;
  eventCount: number;
  recurringEventCount: number;
  futureTransactionCount: number;
  savings: number;
  overdraft: number;
  overdraftAccountCount: number;
  suggestion: SafeToSpendSuggestion | null;
}
