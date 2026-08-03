import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "@/components/empty-state";
import { MonthNavigator } from "@/components/month-navigator";
import { TransactionRow } from "@/components/transaction-row";
import { listAccounts } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { listTransactionsByMonth } from "@/db/transactions";
import { spacing, useTheme } from "@/theme";
import type { Account, Transaction } from "@/types";
import { formatAmount, formatMonthLabel } from "@/utils/format";

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

  const income = (transactions ?? []).reduce(
    (sum, t) => (t.type === "income" ? sum + t.amount : sum),
    0,
  );
  const expense = (transactions ?? []).reduce(
    (sum, t) => (t.type === "expense" ? sum + t.amount : sum),
    0,
  );
  const fees = (transactions ?? []).reduce(
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
      <FlatList
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
        data={transactions ?? []}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TransactionRow transaction={item} onPress={() => openEdit(item.id)} />
        )}
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
