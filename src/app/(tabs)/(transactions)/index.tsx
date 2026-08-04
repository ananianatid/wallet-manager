import { ListFilter, Plus, Search, X } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EmptyState } from "@/components/empty-state";
import { MonthHeader } from "@/components/month-header";
import { TransactionRow } from "@/components/transaction-row";
import { listAccounts } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { applyDueRecurring } from "@/db/recurring";
import { getSetting, setSetting } from "@/db/settings";
import { listTransactions, searchTransactions } from "@/db/transactions";
import { filterTransactions, setTransactionFilters, useTransactionFilters } from "@/state/transaction-filters";
import { radius, spacing, useTheme } from "@/theme";
import type { Account, Transaction } from "@/types";
import {
  formatAmount,
  formatDayLabel,
  formatMonthLabel,
} from "@/utils/format";

interface DaySection {
  key: string;
  title: string;
  total: number;
  data: Transaction[];
}

interface MonthSection {
  key: string;
  title: string;
  total: number;
  data: Transaction[];
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const filters = useTransactionFilters();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Transaction[] | null>(
    null,
  );

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
        order: filters.mode === "month" ? "asc" : "desc",
      }),
      listAccounts(db),
    ]);
    setTransactions(filterTransactions(rows, filters));
    setAccounts(accs);
  }, [filters]);

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
      return;
    }
    const generated = await applyDueRecurring(db, Date.now());
    await setSetting(db, "recurring_last_check", String(todayKey));
    if (generated > 0) {
      Alert.alert(
        "Transactions récurrentes",
        `${generated} transaction${generated > 1 ? "s" : ""} générée${generated > 1 ? "s" : ""} automatiquement.`,
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      checkRecurring();
    }, [load, checkRecurring]),
  );

  const activeSearch = searching && query.trim().length > 0;

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const t of transactions ?? []) {
      set.add(new Date(t.transactionDate).getFullYear());
    }
    return [...set].sort((a, b) => b - a);
  }, [transactions]);

  const setMonth = (year: number, month: number) =>
    setTransactionFilters({ ...filters, year, month });

  useEffect(() => {
    if (!activeSearch) {
      return;
    }
    let cancelled = false;
    getDatabase()
      .then((db) => searchTransactions(db, query.trim()))
      .then((rows) => {
        if (!cancelled) {
          setSearchResults(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchResults([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSearch, query]);

  const sections = useMemo<DaySection[] | MonthSection[]>(() => {
    const rows = activeSearch
      ? filterTransactions(searchResults ?? [], filters)
      : (transactions ?? []);

    if (!activeSearch && filters.mode === "all") {
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
        section.total +=
          t.type === "income"
            ? t.amount
            : t.type === "expense"
              ? -t.amount
              : t.fee
                ? -t.fee
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
          total: 0,
          data: [],
        };
        groups.set(key, section);
      }
      section.data.push(t);
      section.total +=
        t.type === "income"
          ? t.amount
          : t.type === "expense"
            ? -t.amount
            : t.fee
              ? -t.fee
              : 0;
    }
    return [...groups.values()];
  }, [activeSearch, searchResults, transactions, filters]);

  const monthRows = transactions ?? [];
  const income = monthRows.reduce(
    (sum, t) => (t.type === "income" ? sum + t.amount : sum),
    0,
  );
  const expense = monthRows.reduce(
    (sum, t) => (t.type === "expense" ? sum + t.amount : sum),
    0,
  );
  const fees = monthRows.reduce(
    (sum, t) => (t.type === "transfer" && t.fee ? sum + t.fee : sum),
    0,
  );
  const net = income - expense - fees;

  const openNew = () => router.push("/new-transaction");
  const openEdit = (id: number) =>
    router.push({ pathname: "/new-transaction", params: { id: String(id) } });

  const hasTransactions = monthRows.length > 0;
  const openFilters = () => router.push("/filters");

  const toggleSearch = () => {
    setQuery("");
    setSearching((v) => !v);
  };

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
            <View style={styles.headerActions}>
              <Pressable
                onPress={openFilters}
                hitSlop={8}
                accessibilityLabel="Personnaliser les filtres"
              >
                <ListFilter size={21} strokeWidth={2.2} color={theme.accent} />
              </Pressable>
              <Pressable
                onPress={toggleSearch}
                hitSlop={8}
                accessibilityLabel={searching ? "Fermer la recherche" : "Rechercher"}
              >
                {searching ? (
                  <X size={22} strokeWidth={2.2} color={theme.accent} />
                ) : (
                  <Search size={22} strokeWidth={2.2} color={theme.accent} />
                )}
              </Pressable>
            </View>
          ),
        }}
      />
      {searching ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
          }}
        >
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.surfaceElevated },
            ]}
          >
            <Search size={17} strokeWidth={2.2} color={theme.secondaryLabel} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher une transaction…"
              placeholderTextColor={theme.secondaryLabel}
              autoFocus
              accessibilityLabel="Recherche de transaction"
              style={[styles.searchInput, { color: theme.label }]}
            />
          </View>
        </View>
      ) : null}
      <SectionList
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
        sections={sections}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            hideDate={filters.mode === "month"}
            onPress={() => openEdit(item.id)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View
            style={[
              styles.dayHeader,
              { backgroundColor: theme.background },
            ]}
          >
            <Text style={{ color: theme.secondaryLabel, fontSize: 13, fontWeight: "600" }}>
              {section.title}
            </Text>
            <Text
              style={[
                styles.dayTotal,
                {
                  color:
                    section.total >= 0 ? theme.label : theme.expense,
                },
              ]}
            >
              {formatAmount(section.total)}
            </Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: spacing.lg + 22 }} />
        )}
        ListHeaderComponent={
          activeSearch ? null : (
            <View style={{ gap: spacing.lg, paddingTop: spacing.lg }}>
              <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xs }}>
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                  {filters.mode === "month"
                    ? `Solde du mois · ${formatMonthLabel(filters.year, filters.month)}`
                    : "Solde toutes périodes"}
                </Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                      Revenus
                    </Text>
                    <Text
                      selectable
                      style={{ color: theme.income, fontWeight: "700", fontVariant: ["tabular-nums"] }}
                    >
                      + {formatAmount(income)}
                    </Text>
                  </View>
                  <View style={[styles.summaryItem, styles.summaryItemCenter]}>
                    <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                      Dépenses
                    </Text>
                    <Text
                      selectable
                      style={{ color: theme.expense, fontWeight: "700", fontVariant: ["tabular-nums"] }}
                    >
                      −{formatAmount(expense + fees)}
                    </Text>
                  </View>
                  <View style={[styles.summaryItem, styles.summaryItemRight]}>
                    <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                      Solde
                    </Text>
                    <Text
                      selectable
                      style={{
                        color: net >= 0 ? theme.label : theme.expense,
                        fontWeight: "800",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {formatAmount(net)}
                    </Text>
                  </View>
                </View>
              </View>
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
          )
        }
        ListEmptyComponent={
          activeSearch && searchResults ? (
            <EmptyState
              title="Aucune transaction trouvée"
              message="Essayez une note, une catégorie, un compte ou un montant."
            />
          ) : null
        }
      />
      {hasTransactions ? (
        <Pressable
          onPress={openNew}
          accessibilityLabel="Ajouter une transaction"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.accent },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Plus size={30} strokeWidth={2.5} color="#0A0A0B" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    gap: spacing.xs,
    alignItems: "flex-start",
  },
  summaryItemCenter: {
    alignItems: "center",
  },
  summaryItemRight: {
    alignItems: "flex-end",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  dayTotal: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
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
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
  },
});
