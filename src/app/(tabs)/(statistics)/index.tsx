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
import { CategoryIcon } from "@/components/category-icons";
import { IconButton, ScreenState } from "@/components/ui";
import { listBudgets } from "@/db/budgets";
import { getDatabase } from "@/db/database";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { listSavingsRules } from "@/db/savings";
import { listTransactionsByRange, listTransactionYears } from "@/db/transactions";
import { chartColors, radius, spacing, useTheme } from "@/theme";
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
  const [periodOpen, setPeriodOpen] = useState(false);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const periodStartMs = new Date(start.year, start.month, 1).getTime();
    const endMs = new Date(end.year, end.month + 1, 1).getTime();
    const [b, s, ys] = await Promise.all([
      listBudgets(db),
      listSavingsRules(db),
      listTransactionYears(db),
    ]);
    const ruleStarts = s
      .map((rule) => rule.startDate)
      .filter((d): d is number => d != null);
    const earliestStartMs =
      ruleStarts.length > 0
        ? Math.min(periodStartMs, ...ruleStarts)
        : periodStartMs;
    const rows = await listTransactionsByRange(db, earliestStartMs, endMs);
    const yearSet = new Set<number>([new Date().getFullYear(), ...ys]);
    return {
      transactions: rows,
      budgets: b,
      savingsRules: s,
      years: [...yearSet].sort((a, b) => b - a),
      periodStartMs,
      earliestStartMs,
    };
  }, [start, end]);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const transactions = resource.data?.transactions ?? null;
  const budgets = useMemo(() => resource.data?.budgets ?? [], [resource.data?.budgets]);
  const savingsRules = useMemo(
    () => resource.data?.savingsRules ?? [],
    [resource.data?.savingsRules],
  );
  const years = resource.data?.years ?? [];

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
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
  const periodStartMs = useMemo(
    () => new Date(start.year, start.month, 1).getTime(),
    [start],
  );
  const periodRows = useMemo(
    () => rows.filter((t) => t.transactionDate >= periodStartMs),
    [rows, periodStartMs],
  );
  const t = useMemo(() => totals(periodRows), [periodRows]);
  const slices = useMemo(() => expenseByCategory(periodRows), [periodRows]);
  const series = useMemo(
    () => monthlySeries(periodRows, months),
    [periodRows, months],
  );

  const spentByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const tx of periodRows) {
      if (tx.type === "expense" && tx.categoryId != null) {
        map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount);
      }
    }
    return map;
  }, [periodRows]);

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
    () => savingsByRule(rows, savingsRules, periodStartMs),
    [rows, savingsRules, periodStartMs],
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

  const hasActivity = periodRows.length > 0;
  const periodLabel =
    months.length === 1
      ? formatMonthLabel(start.year, start.month)
      : `du ${formatMonthLabel(start.year, start.month)} au ${formatMonthLabel(
          end.year,
          end.month,
        )}`;
  const earliestStartMs = resource.data?.earliestStartMs ?? periodStartMs;
  const savingsLabel =
    earliestStartMs < periodStartMs
      ? `depuis ${formatMonthLabel(
          new Date(earliestStartMs).getFullYear(),
          new Date(earliestStartMs).getMonth(),
        )}`
      : periodLabel;

  return (
    <>
      <Stack.Screen
        options={{
          title: periodLabel,
          headerRight: () => (
            <IconButton
              onPress={() => setPeriodOpen(true)}
              label="Choisir la période"
              icon={<CalendarDays size={21} strokeWidth={2.2} color={theme.accent} />}
            />
          ),
        }}
      />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={resource.error?.message}
          onRetry={() => void resource.reload()}
        />
      ) : (
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
      >
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
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={`Dépenses par catégorie : ${slices
                  .map((slice) => `${slice.categoryName}, ${Math.round(slice.pct)} pour cent, ${formatAmount(slice.total)}`)
                  .join(". ")}`}
              >
                <PieChart
                  slices={slices.map((s, i) => ({
                    value: s.total,
                    color: chartColors[i % chartColors.length],
                  }))}
                />
              </View>
            </View>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {slices.map((slice, index) => (
                <View key={slice.categoryName} style={styles.legendRow}>
                  {slice.categoryIcon ? (
                    <CategoryIcon
                      name={slice.categoryIcon}
                      size={17}
                      color={chartColors[index % chartColors.length]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            chartColors[index % chartColors.length],
                        },
                      ]}
                    />
                  )}
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
                  {budget.categoryIcon ? (
                    <CategoryIcon name={budget.categoryIcon} size={17} color={theme.accent} />
                  ) : null}
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
          Épargne · {savingsLabel}
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
                  {rule.categoryIcon ? (
                    <CategoryIcon name={rule.categoryIcon} size={17} color={theme.accent} />
                  ) : null}
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

      {months.length > 1 ? (
        <View style={[styles.card, { backgroundColor: theme.surface, gap: spacing.md }]}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Évolution · {periodLabel}
          </Text>
          {!hasActivity ? (
            <Text style={{ color: theme.secondaryLabel, textAlign: "center", paddingVertical: spacing.lg }}>
              Aucune activité sur la période.
            </Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
                Revenus vs dépenses
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
              </ScrollView>
            </View>
          )}
        </View>
      ) : null}
      </ScrollView>
      )}
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
});
