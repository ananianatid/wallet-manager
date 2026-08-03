import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "@/components/empty-state";
import { MonthNavigator } from "@/components/month-navigator";
import { TransactionRow } from "@/components/transaction-row";
import { listAccounts } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { listTransactionsByMonth } from "@/db/transactions";
import { spacing, useTheme } from "@/theme";
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

  const sections = useMemo<DaySection[]>(() => {
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
  }, [transactions]);

  const rows = transactions ?? [];
  const income = rows.reduce(
    (sum, t) => (t.type === "income" ? sum + t.amount : sum),
    0,
  );
  const expense = rows.reduce(
    (sum, t) => (t.type === "expense" ? sum + t.amount : sum),
    0,
  );
  const fees = rows.reduce(
    (sum, t) => (t.type === "transfer" && t.fee ? sum + t.fee : sum),
    0,
  );
  const net = income - expense - fees;

  const openNew = () => router.push("/new-transaction");
  const openEdit = (id: number) =>
    router.push({ pathname: "/new-transaction", params: { id: String(id) } });

  const hasTransactions = (transactions ?? []).length > 0;

  return (
    <View style={{ flex: 1 }}>
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
        }
        ListEmptyComponent={null}
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
          <Text style={styles.fabLabel}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  fabLabel: {
    color: "#0A0A0B",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
  },
});
