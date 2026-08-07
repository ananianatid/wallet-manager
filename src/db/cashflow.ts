import type { SQLiteDatabase } from "expo-sqlite";
import { listAccounts } from "./accounts";
import { listGoals } from "./goals";
import { listRecurring, applyDueRecurring } from "./recurring";
import { listSavingsRules } from "./savings";
import { listTransactions } from "./transactions";
import { savingsByRule } from "../utils/statistics";
import { convertMinorAmount } from "@/currency/currencies";
import { getRateForPair, getReferenceCurrency } from "@/currency/service";
import type {
  Account,
  Frequency,
  RecurringTransaction,
  SafeToSpend,
  Transaction,
} from "../types";

const DAY_MS = 86_400_000;
const FALLBACK_HORIZON_DAYS = 30;

interface ForecastEvent {
  date: number;
  impact: number;
  isRecurring: boolean;
}

function advanceDate(nextMs: number, frequency: Frequency, interval: number): number {
  const date = new Date(nextMs);
  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + interval);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7 * interval);
      break;
    case "monthly": {
      const targetMonth = date.getMonth();
      date.setMonth(date.getMonth() + interval);
      if (date.getMonth() !== (targetMonth + interval) % 12) {
        date.setDate(0);
      }
      break;
    }
    case "yearly": {
      const targetMonth = date.getMonth();
      date.setFullYear(date.getFullYear() + interval);
      if (date.getMonth() !== targetMonth) {
        date.setDate(0);
      }
      break;
    }
  }
  return date.getTime();
}

function isIncluded(accountId: number, accounts: Map<number, Account>): boolean {
  return accounts.get(accountId)?.excludeFromTotal !== true;
}

function transactionImpact(
  transaction: Pick<Transaction, "type" | "amount" | "fee" | "accountId" | "destinationAccountId" | "destinationAmount" | "accountCurrencyCode" | "destinationCurrencyCode">,
  accounts: Map<number, Account>,
  referenceCurrency: string,
  rates: Map<string, number>,
): number {
  const toReference = (amount: number, currency: string | null | undefined): number => {
    if (!currency || currency === referenceCurrency) return amount;
    const rate = rates.get(currency);
    return rate == null ? 0 : convertMinorAmount(amount, currency, referenceCurrency, rate);
  };
  if (transaction.type === "income") {
    return isIncluded(transaction.accountId, accounts)
      ? toReference(transaction.amount, transaction.accountCurrencyCode)
      : 0;
  }
  if (transaction.type === "expense") {
    return isIncluded(transaction.accountId, accounts)
      ? -toReference(transaction.amount, transaction.accountCurrencyCode)
      : 0;
  }

  let impact = 0;
  if (isIncluded(transaction.accountId, accounts)) {
    impact -=
      toReference(transaction.amount, transaction.accountCurrencyCode) +
      toReference(transaction.fee ?? 0, transaction.accountCurrencyCode);
  }
  if (
    transaction.destinationAccountId != null &&
    isIncluded(transaction.destinationAccountId, accounts)
  ) {
    impact += toReference(
      transaction.destinationAmount ?? transaction.amount,
      transaction.destinationCurrencyCode,
    );
  }
  return impact;
}

function nextOccurrence(
  recurring: RecurringTransaction,
  now: number,
): number | null {
  let date = recurring.nextDate;
  let guard = 0;
  while (date <= now && guard < 120) {
    date = advanceDate(date, recurring.frequency, recurring.interval);
    guard += 1;
  }
  if (guard >= 120 || recurring.endDate != null && date > recurring.endDate) {
    return null;
  }
  return date;
}

function recurringEvents(
  recurring: RecurringTransaction[],
  accounts: Map<number, Account>,
  now: number,
  horizon: number,
  referenceCurrency: string,
  rates: Map<string, number>,
): ForecastEvent[] {
  const events: ForecastEvent[] = [];
  for (const row of recurring) {
    if (!row.isActive) continue;
    let date = nextOccurrence(row, now);
    let guard = 0;
    while (
      date != null &&
      date <= horizon &&
      guard < 120 &&
      (row.endDate == null || date <= row.endDate)
    ) {
      events.push({
        date,
        impact: transactionImpact(
          {
            ...row,
            accountCurrencyCode: row.sourceCurrencyCode,
            destinationCurrencyCode: row.destinationCurrencyCode,
            destinationAmount: row.amount,
          },
          accounts,
          referenceCurrency,
          rates,
        ),
        isRecurring: true,
      });
      date = advanceDate(date, row.frequency, row.interval);
      guard += 1;
    }
  }
  return events;
}

function findNextIncome(
  transactions: Transaction[],
  recurring: RecurringTransaction[],
  accounts: Map<number, Account>,
  now: number,
): number | null {
  const transactionDates = transactions
    .filter(
      (transaction) =>
        transaction.transactionDate > now &&
        transaction.type === "income" &&
        isIncluded(transaction.accountId, accounts),
    )
    .map((transaction) => transaction.transactionDate);
  const recurringDates = recurring
    .filter(
      (row) => row.isActive && row.type === "income" && isIncluded(row.accountId, accounts),
    )
    .map((row) => nextOccurrence(row, now))
    .filter((date): date is number => date != null);
  const dates = [...transactionDates, ...recurringDates];
  return dates.length > 0 ? Math.min(...dates) : null;
}

export async function calculateSafeToSpend(
  db: SQLiteDatabase,
  now = Date.now(),
): Promise<SafeToSpend> {
  // Due recurring rows become real transactions first, so the forecast cannot double-count them.
  await applyDueRecurring(db, now);
  const [accountsRows, transactions, recurring, goals, savingsRules] = await Promise.all([
    listAccounts(db),
    listTransactions(db),
    listRecurring(db),
    listGoals(db),
    listSavingsRules(db),
  ]);
  const referenceCurrency = await getReferenceCurrency(db);
  const currencies = new Set(accountsRows.map((account) => account.currencyCode));
  for (const transaction of transactions) {
    if (transaction.accountCurrencyCode) currencies.add(transaction.accountCurrencyCode);
    if (transaction.destinationCurrencyCode) currencies.add(transaction.destinationCurrencyCode);
  }
  const rates = new Map<string, number>();
  for (const currency of currencies) {
    if (currency === referenceCurrency) {
      rates.set(currency, 1);
      continue;
    }
    const rate = await getRateForPair(db, currency, referenceCurrency);
    if (rate) rates.set(currency, rate.rate);
  }
  const accounts = new Map(accountsRows.map((account) => [account.id, account]));
  const nextIncomeDate = findNextIncome(transactions, recurring, accounts, now);
  const usesFallbackHorizon = nextIncomeDate == null;
  const horizonDate = nextIncomeDate ?? now + FALLBACK_HORIZON_DAYS * DAY_MS;

  const currentBalance = transactions
    .filter((transaction) => transaction.transactionDate <= now)
    .reduce(
      (sum, transaction) =>
        sum + transactionImpact(transaction, accounts, referenceCurrency, rates),
      0,
    );
  const reserved = accountsRows
    .filter((account) => !account.excludeFromTotal)
    .reduce((sum, account) => {
      const rate = rates.get(account.currencyCode) ?? 1;
      return sum + convertMinorAmount(account.reservedAmount, account.currencyCode, referenceCurrency, rate);
    }, 0);
  const currentAvailable = currentBalance - reserved;

  const manualEvents = transactions
    .filter(
      (transaction) =>
        transaction.transactionDate > now && transaction.transactionDate <= horizonDate,
    )
    .map<ForecastEvent>((transaction) => ({
      date: transaction.transactionDate,
      impact: transactionImpact(transaction, accounts, referenceCurrency, rates),
      isRecurring: false,
    }));
  const futureRecurringEvents = recurringEvents(
    recurring,
    accounts,
    now,
    horizonDate,
    referenceCurrency,
    rates,
  );
  const events = [...manualEvents, ...futureRecurringEvents];
  const plannedIncome = events
    .filter((event) => event.impact > 0)
    .reduce((sum, event) => sum + event.impact, 0);
  const plannedOutflows = events
    .filter((event) => event.impact < 0)
    .reduce((sum, event) => sum - event.impact, 0);

  const current = new Date(now);
  const currentMonthStart = new Date(current.getFullYear(), current.getMonth(), 1);
  const nextMonthStart = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  const ruleStarts = savingsRules
    .map((rule) => rule.startDate)
    .filter((date): date is number => date != null);
  const earliestStartMs =
    ruleStarts.length > 0
      ? Math.min(currentMonthStart.getTime(), ...ruleStarts)
      : currentMonthStart.getTime();
  const savingsWindow = transactions.filter(
    (transaction) =>
      transaction.transactionDate >= earliestStartMs &&
      transaction.transactionDate < nextMonthStart.getTime(),
  );
  const savings = savingsByRule(
    savingsWindow,
    savingsRules,
    currentMonthStart.getTime(),
    (amount, currency) => {
      if (currency === referenceCurrency) return amount;
      const rate = rates.get(currency);
      return rate == null
        ? 0
        : convertMinorAmount(amount, currency, referenceCurrency, rate);
    },
  )
    .filter(({ rule }) => rule.subtractFromAvailable)
    .reduce((sum, contribution) => sum + contribution.amount, 0);

  const amount = currentAvailable + plannedIncome - plannedOutflows - savings;
  const largestGoal = goals
    .filter((goal) => goal.status === "active" && goal.reservedAmount > 0)
    .sort((a, b) => b.reservedAmount - a.reservedAmount)[0];
  const deficit = Math.max(0, -amount);

  return {
    amount,
    currentAvailable,
    horizonDate,
    nextIncomeDate,
    usesFallbackHorizon,
    plannedIncome,
    plannedOutflows,
    savings,
    eventCount: events.length,
    recurringEventCount: futureRecurringEvents.length,
    futureTransactionCount: manualEvents.length,
    suggestion:
      deficit > 0 && largestGoal
        ? {
            goalId: largestGoal.id,
            goalName: largestGoal.name,
            amount: Math.min(deficit, largestGoal.reservedAmount),
          }
        : null,
  };
}
