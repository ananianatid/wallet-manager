import { CalendarDays } from "lucide-react-native";
import { router, useFocusEffect, Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PeriodSheet } from "@/components/period-sheet";
import { PieChart } from "@/components/pie-chart";
import { listBudgets } from "@/db/budgets";
import { getDatabase } from "@/db/database";
import { listSavingsRules } from "@/db/savings";
import { listTransactionsByRange, listTransactionYears } from "@/db/transactions";
import { chartColors, radius, spacing, useTheme } from "@/theme";
import type { Budget, SavingsRule, Transaction } from "@/types";
import { formatAmount, formatMonthLabel } from "@/utils/format";
import {
  enumerateMonths,
  expenseByCategory,
  monthlySeries,
  savingsByRule,
  totals,
  type MonthRef,
} from "@/utils/statistics";

const BAR_HEIGHT = 130;
const BAR_WIDTH = 9;
const BAR_GAP = 3;

export default function StatisticsScreen() {
  const theme = useTheme();
  const now = new Date();
  const [start, setStart] = useState<MonthRef>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [end, setEnd] = useState<MonthRef>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsRules, setSavingsRules] = useState<SavingsRule[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [periodOpen, setPeriodOpen] = useState(false);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const startMs = new Date(start.year, start.month, 1).getTime();
    const endMs = new Date(end.year, end.month + 1, 1).getTime();
    const [rows, b, s, ys] = await Promise.all([
      listTransactionsByRange(db, startMs, endMs),
      listBudgets(db),
      listSavingsRules(db),
      listTransactionYears(db),
    ]);
    setTransactions(rows);
    setBudgets(b);
    setSavingsRules(s);
    setYears((prev) => {
      const set = new Set<number>([new Date().getFullYear(), ...ys]);
      const next = [...set].sort((a, b) => b - a);
      return prev.length === next.length && prev.every((v, i) => v === next[i])
        ? prev
        : next;
    });
  }, [start, end]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const months = useMemo(
    () =>
      enumerateMonths(start, end).sort(
        (a, b) =>
          a.year * 12 + a.month - (b.year * 12 + b.month),
      ),
    [start, end],
  );

  const rows = useMemo(() => transactions ?? [], [transactions]);
  const t = useMemo(() => totals(rows), [rows]);
  const slices = useMemo(() => expenseByCategory(rows), [rows]);
  const series = useMemo(() => monthlySeries(rows, months), [rows, months]);

  const spentByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const tx of rows) {
      if (tx.type === "expense" && tx.categoryId != null) {
        map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount);
      }
    }
    return map;
  }, [rows]);

  const budgetRows = useMemo(
    () =>
      budgets.map((budget) => {
        const spent =
          budget.categoryId == null
            ? t.expense
            : (spentByCategory.get(budget.categoryId) ?? 0);
        return { budget, spent };
      }),
    [budgets, spentByCategory, t.expense],
  );

  const savings = useMemo(
    () => savingsByRule(rows, savingsRules),
    [rows, savingsRules],
  );
  const savingsTotal = useMemo(
    () => savings.reduce((sum, s) => sum + s.amount, 0),
    [savings],
  );

  const changePeriod = (s: MonthRef, e: MonthRef) => {
    setStart(s);
    setEnd(e);
  };

  const maxBar = Math.max(t.income, t.expense + t.fees, 1);
  const maxAbsSolde = Math.max(
    ...series.map((m) => Math.abs(m.net)),
    1,
  );

  const hasActivity = rows.length > 0;
  const periodLabel =
    months.length === 1
      ? formatMonthLabel(start.year, start.month)
      : `du ${formatMonthLabel(start.year, start.month)} au ${formatMonthLabel(
          end.year,
          end.month,
        )}`;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => setPeriodOpen(true)}
              hitSlop={8}
              accessibilityLabel="Choisir la période"
            >
              <CalendarDays size={21} strokeWidth={2.2} color={theme.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <View style={[styles.card, { backgroundColor: theme.surface, gap: 2 }]}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Revenus vs dépenses · {periodLabel}
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
          {formatAmount(t.net)}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs }}>
          <Text
            style={{
              color: theme.income,
              fontWeight: "600",
              fontVariant: ["tabular-nums"],
            }}
          >
            + {formatAmount(t.income)}
          </Text>
          <Text
            style={{
              color: theme.expense,
              fontWeight: "600",
              fontVariant: ["tabular-nums"],
            }}
          >
            −{formatAmount(t.expense + t.fees)}
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, gap: spacing.md }]}>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
          Dépenses par catégorie
        </Text>
        {slices.length === 0 ? (
          <Text style={{ color: theme.secondaryLabel, textAlign: "center", paddingVertical: spacing.lg }}>
            {hasActivity
              ? "Aucune dépense sur la période."
              : "Aucune activité sur la période."}
          </Text>
        ) : (
          <>
            <View style={{ alignItems: "center" }}>
              <PieChart
                slices={slices.map((s, i) => ({
                  value: s.total,
                  color: chartColors[i % chartColors.length],
                }))}
              />
            </View>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {slices.map((slice, index) => (
                <View key={slice.categoryName} style={styles.legendRow}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          chartColors[index % chartColors.length],
                      },
                    ]}
                  />
                  <Text
                    style={[styles.legendName, { color: theme.label }]}
                    numberOfLines={1}
                  >
                    {slice.categoryName}
                  </Text>
                  <Text
                    style={{ color: theme.secondaryLabel, fontSize: 13 }}
                  >
                    {slice.pct.toLocaleString("fr-FR", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </Text>
                  <Text
                    style={[
                      styles.legendAmount,
                      { color: theme.label },
                    ]}
                  >
                    {formatAmount(slice.total)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {budgetRows.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.surface, gap: spacing.md }]}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Budgets · {t.expense.toLocaleString("fr-FR")} F dépensés
          </Text>
          {budgetRows.map(({ budget, spent }) => {
            const pct = Math.min((spent / budget.amount) * 100, 100);
            const over = spent > budget.amount;
            const color = over
              ? theme.expense
              : spent >= budget.amount * 0.8
                ? "#F59E0B"
                : theme.accent;
            return (
              <View key={budget.id} style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Text style={[styles.legendName, { color: theme.label }]} numberOfLines={1}>
                    {budget.categoryName ?? "Toutes les dépenses"}
                  </Text>
                  <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                    {Math.round((spent / budget.amount) * 100)}%
                  </Text>
                  <Text style={{ color: theme.label, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                    {formatAmount(spent)} / {formatAmount(budget.amount)}
                  </Text>
                </View>
                <View
                  style={{
                    height: 8,
                    borderRadius: radius.md,
                    backgroundColor: theme.surfaceElevated,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: radius.md,
                      backgroundColor: color,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.surface, gap: spacing.md }]}>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
          Épargne · {periodLabel}
        </Text>
        {savings.length === 0 ? (
          <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
            <Text style={{ color: theme.secondaryLabel, textAlign: "center" }}>
              Aucune règle d&apos;épargne. Définissez un pourcentage par catégorie de
              revenus pour voir votre cible en temps réel.
            </Text>
            <Pressable
              onPress={() => router.push("/savings")}
              style={({ pressed }) => [
                {
                  backgroundColor: theme.accent,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.sm + 2,
                  borderRadius: radius.xl,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>
                Configurer
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              {savings.map(({ rule, amount }) => (
                <View key={rule.id} style={styles.legendRow}>
                  <Text style={[styles.legendName, { color: theme.label }]} numberOfLines={1}>
                    {rule.categoryName ?? "Tous les revenus"}
                  </Text>
                  <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                    {rule.percent} %
                  </Text>
                  <Text style={[styles.legendAmount, { color: theme.label }]}>
                    {formatAmount(amount)}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.separator,
                paddingTop: spacing.md,
              }}
            >
              <Text style={{ color: theme.secondaryLabel, fontWeight: "600" }}>
                À épargner
              </Text>
              <Text
                selectable
                style={{
                  color: theme.accent,
                  fontWeight: "800",
                  fontSize: 17,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatAmount(savingsTotal)}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, gap: spacing.md }]}>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
          Évolution · {periodLabel}
        </Text>
        {!hasActivity ? (
          <Text style={{ color: theme.secondaryLabel, textAlign: "center", paddingVertical: spacing.lg }}>
            Aucune activité sur la période.
          </Text>
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
                Revenus vs dépenses
              </Text>
              <View style={styles.barsRow}>
                {series.map((m) => (
                  <View key={`${m.year}-${m.month}`} style={styles.barGroup}>
                    <View style={styles.barPair}>
                      <View
                        style={{
                          width: BAR_WIDTH,
                          height: Math.max(
                            (m.income / maxBar) * BAR_HEIGHT,
                            m.income > 0 ? 2 : 0,
                          ),
                          backgroundColor: theme.income,
                          borderRadius: 3,
                        }}
                      />
                      <View
                        style={{
                          width: BAR_WIDTH,
                          height: Math.max(
                            ((m.expense + m.fees) / maxBar) * BAR_HEIGHT,
                            m.expense + m.fees > 0 ? 2 : 0,
                          ),
                          backgroundColor: theme.expense,
                          borderRadius: 3,
                        }}
                      />
                    </View>
                    <Text style={[styles.monthLabel, { color: theme.secondaryLabel }]}>
                      {new Date(m.year, m.month, 1)
                        .toLocaleDateString("fr-FR", { month: "short" })
                        .replace(".", "")}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
                Solde mensuel
              </Text>
              <View style={styles.barsRow}>
                {series.map((m) => {
                  const h = (Math.abs(m.net) / maxAbsSolde) * (BAR_HEIGHT / 2);
                  const positive = m.net >= 0;
                  return (
                    <View key={`${m.year}-${m.month}`} style={styles.barGroup}>
                      <View
                        style={[
                          styles.soldeCell,
                          { borderColor: theme.separator },
                        ]}
                      >
                        {m.net === 0 ? null : (
                          <View
                            style={{
                              width: BAR_WIDTH,
                              height: Math.max(h, 2),
                              backgroundColor: positive
                                ? theme.income
                                : theme.expense,
                              borderRadius: 3,
                            }}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.monthLabel,
                          { color: theme.secondaryLabel },
                        ]}
                      >
                        {new Date(m.year, m.month, 1)
                          .toLocaleDateString("fr-FR", { month: "short" })
                          .replace(".", "")}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View
              style={{
                marginTop: spacing.sm,
                gap: spacing.sm,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.separator,
                paddingTop: spacing.md,
              }}
            >
              {series.map((m) => (
                <View key={`${m.year}-${m.month}`} style={styles.monthRow}>
                  <Text style={[styles.monthName, { color: theme.label }]}>
                    {formatMonthLabel(m.year, m.month)}
                  </Text>
                  <Text style={{ color: theme.income, fontVariant: ["tabular-nums"], fontSize: 13 }}>
                    + {formatAmount(m.income)}
                  </Text>
                  <Text style={{ color: theme.expense, fontVariant: ["tabular-nums"], fontSize: 13 }}>
                    −{formatAmount(m.expense + m.fees)}
                  </Text>
                  <Text
                    style={[
                      styles.monthSolde,
                      {
                        color: m.net >= 0 ? theme.income : theme.expense,
                      },
                    ]}
                  >
                    {formatAmount(m.net)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
      </ScrollView>
      <PeriodSheet
        visible={periodOpen}
        start={start}
        end={end}
        years={years}
        onChange={changePeriod}
        onClose={() => setPeriodOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    flex: 1,
    fontWeight: "600",
  },
  legendAmount: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    height: BAR_HEIGHT + 22,
  },
  barGroup: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  barPair: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: BAR_GAP,
    height: BAR_HEIGHT,
  },
  monthLabel: {
    fontSize: 11,
  },
  soldeCell: {
    height: BAR_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: BAR_WIDTH + 4,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  monthName: {
    flex: 1,
    fontWeight: "600",
    fontSize: 13,
    textTransform: "capitalize",
  },
  monthSolde: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    fontSize: 13,
    minWidth: 70,
    textAlign: "right",
  },
});
