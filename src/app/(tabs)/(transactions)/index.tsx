import { Search } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { EmptyState } from "@/components/empty-state";
import { MonthHeader } from "@/components/month-header";
import { MonthlySummaryCard } from "@/components/safe-to-spend-card";
import { TransactionRow } from "@/components/transaction-row";
import { listAccounts } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { useCurrency, useCurrencyConverter } from "@/currency/context";
import { applyDueRecurring, listPendingRecurringOccurrences } from "@/db/recurring";
import { schedulePendingRecurringNotifications } from "@/services/recurring-notifications";
import { getSetting, setSetting } from "@/db/settings";
import { listTransactionAmountRows, listTransactions } from "@/db/transactions";
import { setTransactionFilters, useTransactionFilters } from "@/state/transaction-filters";
import { radius, spacing, useTheme } from "@/theme";
import type { Transaction } from "@/types";
import { IconButton, InlineError, ScreenState } from "@/components/ui";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useScrollPerformance } from "@/hooks/use-scroll-performance";
import { isPerformanceProfilingEnabled } from "@/services/performance";
import {
  formatAmount,
  formatDayLabel,
  formatMonthLabel,
} from "@/utils/format";
import { totals } from "@/utils/statistics";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

interface DaySection {
  key: string;
  title: string;
  income: number;
  expense: number;
  data: Transaction[];
}

type TransactionSection = DaySection;

export default function TransactionsScreen() {
  const theme = useTheme();
  const { baseCurrency } = useCurrency();
  const convert = useCurrencyConverter();
  const onScroll = useScrollPerformance("transactions.scroll");
  const filters = useTransactionFilters();
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [recurringNotice, setRecurringNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const startMs =
      filters.mode === "month"
        ? new Date(filters.year, filters.month, 1).getTime()
        : null;
    const endMs =
      filters.mode === "month"
        ? new Date(filters.year, filters.month + 1, 1).getTime()
        : null;
    const hasDisplayFilters =
      filters.accountIds != null ||
      filters.types.length !== 3 ||
      filters.categoryIds != null;
    const [rows, accs, summaryRows] = await Promise.all([
      listTransactions(db, {
        startMs,
        endMs,
        accountIds: filters.accountIds,
        types: filters.types,
        categoryIds: filters.categoryIds,
        order: "desc",
      }),
      listAccounts(db),
      hasDisplayFilters
        ? listTransactionAmountRows(db, { startMs, endMs })
        : Promise.resolve(null),
    ]);
    return {
      transactions: rows,
      accounts: accs,
      monthTotals: totals(summaryRows ?? rows, convert),
    };
  }, [filters, convert]);

  const resource = useAsyncResource(load, "transactions.list");
  const reload = resource.reload;
  const transactions = resource.data?.transactions ?? null;
  const accounts = resource.data?.accounts ?? [];
  const monthTotals = resource.data?.monthTotals ?? null;

  const checkRecurring = useCallback(async () => {
    const db = await getDatabase();
    const today = new Date();
    const todayKey = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const lastCheck = await getSetting(db, "recurring_last_check");
    if (lastCheck === String(todayKey)) {
      return (await listPendingRecurringOccurrences(db)).length;
    }
    await applyDueRecurring(db, Date.now());
    await schedulePendingRecurringNotifications(db);
    await setSetting(db, "recurring_last_check", String(todayKey));
    return (await listPendingRecurringOccurrences(db)).length;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        setRecurringError(null);
        setRecurringNotice(null);
        try {
          const pendingCount = await checkRecurring();
          if (pendingCount > 0) {
            setRecurringNotice(
              `${pendingCount} échéance${pendingCount > 1 ? "s" : ""} récurrente${pendingCount > 1 ? "s" : ""} à valider.`,
            );
          }
        } catch (error) {
          log.error("recurring.apply", "Échec de la vérification des récurrences", error);
          setRecurringError(
            userMessage(error, "Les récurrences n'ont pas pu être vérifiées."),
          );
        }
        await reload();
      };
      void refresh();
    }, [reload, checkRecurring]),
  );

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const t of transactions ?? []) {
      set.add(new Date(t.transactionDate).getFullYear());
    }
    return [...set].sort((a, b) => b - a);
  }, [transactions]);

  const setMonth = (year: number, month: number) =>
    setTransactionFilters({ ...filters, year, month });

  const sections = useMemo<TransactionSection[]>(() => {
    const rows = transactions ?? [];
    const groups = new Map<string, DaySection>();
    for (const t of rows) {
      const date = new Date(t.transactionDate);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      let section = groups.get(key);
      if (!section) {
        section = {
          key,
          title: formatDayLabel(t.transactionDate),
          income: 0,
          expense: 0,
          data: [],
        };
        groups.set(key, section);
      }
      section.data.push(t);
      const amount = convert(t.amount, t.accountCurrencyCode ?? baseCurrency) ?? 0;
      const fee = t.fee == null ? 0 : convert(t.fee, t.accountCurrencyCode ?? baseCurrency) ?? 0;
      if (t.type === "income") {
        section.income += amount;
      } else if (t.type === "expense") {
        section.expense += amount;
      } else if (fee) {
        section.expense += fee;
      }
    }
    return [...groups.values()];
  }, [baseCurrency, convert, transactions]);

  const monthRows = transactions ?? [];

  const openNew = () => router.push("/new-transaction");
  const openDetail = useCallback(
    (id: number) =>
      router.push({ pathname: "/transaction-detail" as never, params: { id: String(id) } }),
    [],
  );

  const hasTransactions = monthRows.length > 0;
  const openSearch = () => router.push("/search");

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: filters.mode === "month" ? undefined : "Transactions",
          headerTitleAlign: "center",
          headerTitle:
            filters.mode === "month"
              ? () => (
                  <MonthHeader
                    year={filters.year}
                    month={filters.month}
                    years={years}
                    onChange={setMonth}
                  />
                )
              : undefined,
          headerRight: () => (
            <IconButton
              onPress={openSearch}
              label="Rechercher et filtrer"
              icon={<Search size={22} strokeWidth={2.2} color={theme.accent} />}
            />
          ),
        }}
      />
      {recurringError ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <InlineError message={recurringError} onRetry={() => void resource.reload()} />
        </View>
      ) : null}
      {resource.status === "error" && resource.data ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <InlineError
            message={userMessage(resource.error, "Les données n'ont pas pu être actualisées.")}
            onRetry={() => void reload()}
          />
        </View>
      ) : null}
      {!resource.data && resource.status === "loading" ? (
        <ScreenState status="loading" />
      ) : !resource.data && resource.status === "error" ? (
        <ScreenState
          status="error"
          message={userMessage(resource.error)}
          onRetry={() => void resource.reload()}
        />
      ) : (
      <SectionList<Transaction, TransactionSection>
        style={{ flex: 1 }}
        onScroll={isPerformanceProfilingEnabled() ? onScroll : undefined}
        scrollEventThrottle={isPerformanceProfilingEnabled() ? 16 : undefined}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 }}
        sections={sections}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item, index, section }) => {
          const isLast = index === section.data.length - 1;
          return (
            <View
              style={[
                styles.sectionCardRow,
                { backgroundColor: theme.surface, borderColor: theme.separator },
                isLast && styles.sectionCardRowLast,
              ]}
            >
              <TransactionRow
                transaction={item}
                hideDate={filters.mode === "month"}
                onPress={openDetail}
              />
              {!isLast ? (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: theme.separator,
                  }}
                />
              ) : null}
            </View>
          );
        }}
        renderSectionHeader={({ section }) => (
          <View
            style={[
              styles.dayHeader,
              { backgroundColor: theme.surface, borderColor: theme.separator },
            ]}
          >
            <Text
              accessibilityRole="header"
              style={{ color: theme.label, fontSize: 14, fontWeight: "700" }}
            >
              {section.title}
            </Text>
            <View style={styles.daySummary}>
              {section.income > 0 ? (
                <Text style={[styles.dayAmount, { color: theme.income }]}>+ {formatAmount(section.income, baseCurrency)}</Text>
              ) : null}
              {section.expense > 0 ? (
                <Text style={[styles.dayAmount, { color: theme.expense }]}>−{formatAmount(section.expense, baseCurrency)}</Text>
              ) : null}
            </View>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg }}>
              {monthTotals && accounts.length > 0 ? (
                <MonthlySummaryCard totals={monthTotals} />
              ) : null}
              {recurringNotice ? (
                <View style={[styles.recurringNotice, { backgroundColor: `${theme.accent}18` }]}>
                  <Text style={{ color: theme.label, flex: 1 }}>{recurringNotice}</Text>
                  <Pressable
                    onPress={() => router.push("/recurring")}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Gérer les transactions récurrentes"
                    accessibilityHint="Ouvre la gestion des transactions récurrentes."
                  >
                    <Text style={{ color: theme.accent, fontWeight: "700" }}>Gérer</Text>
                  </Pressable>
                </View>
              ) : null}
              {accounts.length === 0 || !hasTransactions ? (
                <EmptyState
                  title={
                    accounts.length === 0
                      ? "Commencez par créer un compte"
                      : filters.mode === "month"
                        ? `Aucune transaction en ${formatMonthLabel(filters.year, filters.month)}`
                        : "Aucune transaction correspondant aux filtres"
                  }
                  message={
                    accounts.length === 0
                      ? "Les transactions sont enregistrées sur un compte."
                      : "Ajoutez une entrée, une sortie ou un transfert."
                  }
                  actionLabel={accounts.length === 0 ? "Créer un compte" : "Ajouter une transaction"}
                  onAction={accounts.length === 0 ? () => router.push("/(tabs)/(accounts)") : openNew}
                />
              ) : null}
          </View>
        }
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  recurringNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  daySummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dayAmount: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  sectionCardRow: {
    marginHorizontal: spacing.lg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  sectionCardRowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingBottom: spacing.md + spacing.sm,
  },
});
