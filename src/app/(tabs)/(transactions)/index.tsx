import { Plus, Search } from "lucide-react-native";
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
import { applyDueRecurring } from "@/db/recurring";
import { getSetting, setSetting } from "@/db/settings";
import { listTransactions } from "@/db/transactions";
import { filterTransactions, setTransactionFilters, useTransactionFilters } from "@/state/transaction-filters";
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import type { Transaction } from "@/types";
import { IconButton, InlineError, ScreenState } from "@/components/ui";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

interface MonthSection {
  key: string;
  title: string;
  total: number;
  data: Transaction[];
}

type TransactionSection = DaySection | MonthSection;

export default function TransactionsScreen() {
  const theme = useTheme();
  const { baseCurrency } = useCurrency();
  const convert = useCurrencyConverter();
  const insets = useSafeAreaInsets();
  const filters = useTransactionFilters();
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [recurringNotice, setRecurringNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [rows, accs] = await Promise.all([
      listTransactions(db, {
        startMs:
          filters.mode === "month"
            ? new Date(filters.year, filters.month, 1).getTime()
            : null,
        endMs:
          filters.mode === "month"
            ? new Date(filters.year, filters.month + 1, 1).getTime()
            : null,
        order: "desc",
      }),
      listAccounts(db),
    ]);
    return {
      transactions: filterTransactions(rows, filters),
      accounts: accs,
      monthTotals: totals(rows, convert),
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
      return 0;
    }
    const generated = await applyDueRecurring(db, Date.now());
    await setSetting(db, "recurring_last_check", String(todayKey));
    if (generated > 0) {
      return generated;
    }
    return 0;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        setRecurringError(null);
        setRecurringNotice(null);
        try {
          const generated = await checkRecurring();
          if (generated > 0) {
            setRecurringNotice(
              `${generated} échéance${generated > 1 ? "s" : ""} récurrente${generated > 1 ? "s" : ""} ajoutée${generated > 1 ? "s" : ""} automatiquement.`,
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

    if (filters.mode === "all") {
      const groups = new Map<string, MonthSection>();
      for (const t of rows) {
        const date = new Date(t.transactionDate);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        let section = groups.get(key);
        if (!section) {
          const label = formatMonthLabel(
            date.getFullYear(),
            date.getMonth(),
          );
          section = {
            key,
            title: label.charAt(0).toUpperCase() + label.slice(1),
            total: 0,
            data: [],
          };
          groups.set(key, section);
        }
        section.data.push(t);
        const amount = convert(t.amount, t.accountCurrencyCode ?? baseCurrency) ?? 0;
        const fee = t.fee == null ? 0 : convert(t.fee, t.accountCurrencyCode ?? baseCurrency) ?? 0;
        section.total +=
          t.type === "income"
            ? amount
            : t.type === "expense"
              ? -amount
              : fee
                ? -fee
                : 0;
      }
      const sorted = [...groups.values()];
      sorted.sort((a, b) => (b.key < a.key ? -1 : b.key > a.key ? 1 : 0));
      return sorted;
    }

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
  }, [baseCurrency, convert, filters, transactions]);

  const monthRows = transactions ?? [];

  const openNew = () => router.push("/new-transaction");
  const openEdit = (id: number) =>
    router.push({ pathname: "/new-transaction", params: { id: String(id) } });

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
                { backgroundColor: theme.surface },
                isLast && styles.sectionCardRowLast,
              ]}
            >
              <TransactionRow
                transaction={item}
                hideDate={filters.mode === "month"}
                onPress={() => openEdit(item.id)}
              />
              {!isLast ? (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: theme.separator,
                    marginLeft: spacing.lg + 22,
                    marginRight: spacing.lg,
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
              { backgroundColor: theme.surface },
            ]}
          >
            <Text
              accessibilityRole="header"
              style={{ color: theme.label, fontSize: 14, fontWeight: "700" }}
            >
              {section.title}
            </Text>
            {"income" in section ? (
              <View style={styles.daySummary}>
                {section.income > 0 ? (
                  <Text style={[styles.dayAmount, { color: theme.income }]}>
                    + {formatAmount(section.income, baseCurrency)}
                  </Text>
                ) : null}
                {section.expense > 0 ? (
                  <Text style={[styles.dayAmount, { color: theme.expense }]}>
                    −{formatAmount(section.expense, baseCurrency)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text
                style={[
                  styles.dayTotal,
                  {
                    color:
                      section.total >= 0 ? theme.label : theme.expense,
                  },
                ]}
              >
                {formatAmount(section.total, baseCurrency)}
              </Text>
            )}
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
      {hasTransactions ? (
        <Pressable
          onPress={openNew}
          accessibilityLabel="Ajouter une transaction"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: theme.accent,
              bottom: insets.bottom + spacing.lg,
              boxShadow: `0 4px 12px ${withAlpha(theme.label, "59")}`,
            },
            pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Plus size={30} strokeWidth={2.5} color={theme.onAccent} />
        </Pressable>
      ) : null}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  dayTotal: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
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
  },
  sectionCardRowLast: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingBottom: spacing.md + spacing.sm,
  },
  fab: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
