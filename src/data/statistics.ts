import { getDatabase } from "@/db/database";
import { getSetting } from "@/db/settings";
import { listTransactions, listTransactionsByRange } from "@/db/transactions";

export interface StatisticsPeriodBounds {
  startMs: number | null;
  endMs: number | null;
}

export interface StatisticsSnapshot {
  transactions: Awaited<ReturnType<typeof listTransactions>>;
  comparisonTransactions: Awaited<ReturnType<typeof listTransactions>>;
  periodKey: string;
  periodStartMs: number;
  periodEndMs: number | null;
}

export async function loadStatisticsSnapshot(
  periodBounds: StatisticsPeriodBounds,
  previousPeriodBounds: StatisticsPeriodBounds | null,
  periodKey: string,
): Promise<StatisticsSnapshot> {
  const db = await getDatabase();
  if (periodBounds.startMs == null || periodBounds.endMs == null) {
    return {
      transactions: await listTransactions(db, { order: "asc" }),
      comparisonTransactions: [],
      periodKey,
      periodStartMs: 0,
      periodEndMs: null,
    };
  }

  const [transactions, comparisonTransactions] = await Promise.all([
    listTransactionsByRange(db, periodBounds.startMs, periodBounds.endMs),
    previousPeriodBounds?.startMs == null || previousPeriodBounds.endMs == null
      ? Promise.resolve([])
      : listTransactionsByRange(
          db,
          previousPeriodBounds.startMs,
          previousPeriodBounds.endMs,
        ),
  ]);

  return {
    transactions,
    comparisonTransactions,
    periodKey,
    periodStartMs: periodBounds.startMs,
    periodEndMs: periodBounds.endMs,
  };
}

export async function loadWeekStartDaySetting(): Promise<string | null> {
  return getSetting(await getDatabase(), "week_start_day");
}
