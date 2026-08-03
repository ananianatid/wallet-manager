import { Plus, Search, X } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EmptyState } from "@/components/empty-state";
import { MonthNavigator } from "@/components/month-navigator";
import { TransactionRow } from "@/components/transaction-row";
import { listAccounts } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import {
  listTransactionsByMonth,
  searchTransactions,
} from "@/db/transactions";
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

export default function TransactionsScreen() {
  const theme = useTheme();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
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
      listTransactionsByMonth(db, year, month),
      listAccounts(db),
    ]);
    setTransactions(rows);
    setAccounts(accs);
  }, [year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activeSearch = searching && query.trim().length > 0;

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

  const sections = useMemo<DaySection[]>(() => {
    const rows = activeSearch ? (searchResults ?? []) : (transactions ?? []);
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
  }, [activeSearch, searchResults, transactions]);

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

  const toggleSearch = () => {
    setQuery("");
    setSearching((v) => !v);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
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
            hideDate
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
              <MonthNavigator year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
              <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xs }}>
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                  Solde du mois · {formatMonthLabel(year, month)}
                </Text>
                <Text
                  selectable
                  style={{
                    color: theme.label,
                    fontSize: 36,
                    fontWeight: "800",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatAmount(net)}
                </Text>
                <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs }}>
                  <Text style={{ color: theme.income, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                    + {formatAmount(income)}
                  </Text>
                  <Text style={{ color: theme.expense, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                    −{formatAmount(expense + fees)}
                  </Text>
                </View>
              </View>
              {accounts.length === 0 || !hasTransactions ? (
                <EmptyState
                  title={
                    accounts.length === 0
                      ? "Commencez par créer un compte"
                      : `Aucune transaction en ${formatMonthLabel(year, month)}`
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