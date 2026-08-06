import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useFocusEffect, Stack, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CategoryIcon } from "@/components/category-icons";
import { LabeledDonutChart } from "@/components/labeled-donut-chart";
import { ScreenState } from "@/components/ui";
import { getDatabase } from "@/db/database";
import { listSavingsRules } from "@/db/savings";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { listTransactions, listTransactionsByRange } from "@/db/transactions";
import { chartColors, radius, spacing, useTheme, withAlpha } from "@/theme";
import { formatAmount, formatMonthLabel } from "@/utils/format";
import {
  categoryBreakdown,
  enumerateMonths,
  monthFromIndex,
  monthIndex,
  monthlySeries,
  savingsByRule,
  totals,
  type MonthRef,
} from "@/utils/statistics";

const BAR_HEIGHT = 130;
const BAR_WIDTH = 9;
const BAR_GAP = 3;

type Granularity = "month" | "quarter" | "year" | "all";

const GRANULARITY_OPTIONS = [
  { value: "month", label: "Mois" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Année" },
  { value: "all", label: "Tout" },
] as const;

const TYPE_OPTIONS = [
  { value: "income", label: "Revenus" },
  { value: "expense", label: "Dépenses" },
] as const;

function rangeLabel(granularity: Granularity, cursor: MonthRef): string {
  if (granularity === "month") {
    return formatMonthLabel(cursor.year, cursor.month);
  }
  if (granularity === "quarter") {
    return `T${Math.floor(cursor.month / 3) + 1} ${cursor.year}`;
  }
  if (granularity === "year") {
    return String(cursor.year);
  }
  return "Toutes les périodes";
}

export default function StatisticsScreen() {
  const theme = useTheme();
  const now = new Date();
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [cursor, setCursor] = useState<MonthRef>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [granularityOpen, setGranularityOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");

  const range = useMemo<{ start: MonthRef | null; end: MonthRef | null }>(
    () => {
      if (granularity === "all") {
        return { start: null, end: null };
      }
      if (granularity === "month") {
        return { start: cursor, end: cursor };
      }
      if (granularity === "year") {
        return {
          start: { year: cursor.year, month: 0 },
          end: { year: cursor.year, month: 11 },
        };
      }
      const qStart = Math.floor(monthIndex(cursor) / 3) * 3;
      return { start: monthFromIndex(qStart), end: monthFromIndex(qStart + 2) };
    },
    [granularity, cursor],
  );

  const start = range.start;
  const end = range.end;

  const load = useCallback(async () => {
    const db = await getDatabase();
    const rules = await listSavingsRules(db);
    if (granularity === "all") {
      const rows = await listTransactions(db, { order: "asc" });
      return {
        transactions: rows,
        periodStartMs: 0,
        earliestStartMs: 0,
        savingsRules: rules,
      };
    }
    const periodStartMs = new Date(start!.year, start!.month, 1).getTime();
    const endMs = new Date(end!.year, end!.month + 1, 1).getTime();
    const ruleStarts = rules
      .map((rule) => rule.startDate)
      .filter((date): date is number => date != null);
    const earliestStartMs =
      ruleStarts.length > 0
        ? Math.min(periodStartMs, ...ruleStarts)
        : periodStartMs;
    const rows = await listTransactionsByRange(db, earliestStartMs, endMs);
    return {
      transactions: rows,
      periodStartMs,
      earliestStartMs,
      savingsRules: rules,
    };
  }, [granularity, start, end]);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const transactions = resource.data?.transactions ?? null;
  const savingsRules = useMemo(
    () => resource.data?.savingsRules ?? [],
    [resource.data?.savingsRules],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const rows = useMemo(() => transactions ?? [], [transactions]);
  const periodStartMs = resource.data?.periodStartMs ?? 0;
  const periodRows = useMemo(
    () => rows.filter((t) => t.transactionDate >= periodStartMs),
    [rows, periodStartMs],
  );
  const t = useMemo(() => totals(periodRows), [periodRows]);
  const slices = useMemo(
    () => categoryBreakdown(periodRows, type),
    [periodRows, type],
  );
  const months = useMemo(() => {
    if (periodRows.length === 0) {
      return [];
    }
    let minIdx = Infinity;
    let maxIdx = -Infinity;
    for (const r of periodRows) {
      const d = new Date(r.transactionDate);
      const idx = monthIndex({ year: d.getFullYear(), month: d.getMonth() });
      if (idx < minIdx) {
        minIdx = idx;
      }
      if (idx > maxIdx) {
        maxIdx = idx;
      }
    }
    return enumerateMonths(monthFromIndex(minIdx), monthFromIndex(maxIdx));
  }, [periodRows]);
  const series = useMemo(
    () => monthlySeries(periodRows, months),
    [periodRows, months],
  );
  const savings = useMemo(
    () => savingsByRule(rows, savingsRules, periodStartMs),
    [rows, savingsRules, periodStartMs],
  );
  const savingsTotal = useMemo(
    () => savings.reduce((sum, contribution) => sum + contribution.amount, 0),
    [savings],
  );

  const navigate = (delta: number) =>
    setCursor((c) => {
      if (granularity === "month") {
        return monthFromIndex(monthIndex(c) + delta);
      }
      if (granularity === "quarter") {
        return monthFromIndex(monthIndex(c) + 3 * delta);
      }
      return { year: c.year + delta, month: c.month };
    });
  const canNavigate = granularity !== "all";

  const maxBar = Math.max(t.income, t.expense + t.fees, 1);

  const hasActivity = periodRows.length > 0;
  const periodLabel = rangeLabel(granularity, cursor);
  const headerLabel =
    periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);
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
          headerTitleAlign: "center",
          headerTitle: () => (
            <View style={styles.headerTitle}>
              <Pressable
                onPress={() => navigate(-1)}
                disabled={!canNavigate}
                accessibilityRole="button"
                accessibilityLabel="Période précédente"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerArrow,
                  !canNavigate && styles.headerArrowDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <ChevronLeft size={24} strokeWidth={2.4} color={theme.accent} />
              </Pressable>
              <Text
                numberOfLines={1}
                style={[styles.headerLabel, { color: theme.label }]}
              >
                {headerLabel}
              </Text>
              <Pressable
                onPress={() => navigate(1)}
                disabled={!canNavigate}
                accessibilityRole="button"
                accessibilityLabel="Période suivante"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.headerArrow,
                  !canNavigate && styles.headerArrowDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <ChevronRight size={24} strokeWidth={2.4} color={theme.accent} />
              </Pressable>
            </View>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => setGranularityOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Changer la granularité"
              style={styles.granularityChip}
            >
              <Text style={[styles.granularityChipText, { color: theme.accent }]}>
                {
                  GRANULARITY_OPTIONS.find(
                    (o) => o.value === granularity,
                  )!.label
                }
              </Text>
              <ChevronDown size={15} strokeWidth={2.4} color={theme.accent} />
            </Pressable>
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
          <View>
            <View style={[styles.typeControl, { backgroundColor: theme.surface }]}>
              {TYPE_OPTIONS.map((option) => {
                const selected = type === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setType(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.typeSegment,
                      {
                        backgroundColor: selected
                          ? theme.accent
                          : "transparent",
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? "#0A0A0B" : theme.secondaryLabel,
                        fontWeight: "700",
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: theme.separator,
              }}
            />
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface, gap: spacing.md }]}>
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
              {type === "expense"
                ? "Dépenses par catégorie"
                : "Revenus par catégorie"}
            </Text>
            {slices.length === 0 ? (
              <Text
                style={{
                  color: theme.secondaryLabel,
                  textAlign: "center",
                  paddingVertical: spacing.lg,
                }}
              >
                {!hasActivity
                  ? "Aucune activité sur la période."
                  : type === "expense"
                    ? "Aucune dépense sur la période."
                    : "Aucun revenu sur la période."}
              </Text>
            ) : (
              <>
                <View
                  style={{ alignItems: "center" }}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={`${type === "expense" ? "Dépenses" : "Revenus"} par catégorie : ${slices
                    .map(
                      (slice) =>
                        `${slice.categoryName}, ${Math.round(slice.pct)} pour cent, ${formatAmount(slice.total)}`,
                    )
                    .join(". ")}`}
                >
                  <LabeledDonutChart
                    slices={slices.map((s, i) => ({
                      value: s.total,
                      color: chartColors[i % chartColors.length],
                      name: s.categoryName,
                    }))}
                  />
                </View>
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: theme.separator,
                    marginVertical: spacing.sm,
                  }}
                />
                <View style={{ gap: spacing.xs }}>
                  {slices.map((slice, index) => (
                    <View key={slice.categoryName} style={styles.summaryRow}>
                      <View
                        style={[
                          styles.pctBadge,
                          {
                            backgroundColor: withAlpha(
                              chartColors[index % chartColors.length],
                              "18",
                            ),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pctBadgeText,
                            {
                              color: chartColors[index % chartColors.length],
                            },
                          ]}
                        >
                          {Math.round(slice.pct)}%
                        </Text>
                      </View>
                      {slice.categoryIcon ? (
                        <CategoryIcon
                          name={slice.categoryIcon}
                          size={18}
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
                        style={[styles.legendAmount, { color: theme.label }]}
                      >
                        {formatAmount(slice.total)}
                      </Text>
                    </View>
                  ))}
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

          <View style={[styles.card, { backgroundColor: theme.surface, gap: spacing.md }]}>
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
              Épargne · {savingsLabel}
            </Text>
            {savings.length === 0 ? (
              <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
                <Text style={{ color: theme.secondaryLabel, textAlign: "center" }}>
                  Aucune règle d&apos;épargne. Définissez un pourcentage par
                  catégorie de revenus pour voir votre cible en temps réel.
                </Text>
                <Pressable
                  onPress={() => router.push("/savings")}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    {
                      backgroundColor: theme.accent,
                      paddingHorizontal: spacing.xl,
                      paddingVertical: spacing.sm + 2,
                      borderRadius: radius.xl,
                    },
                    pressed && styles.pressed,
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
                    <View key={rule.id} style={styles.summaryRow}>
                      {rule.categoryIcon ? (
                        <CategoryIcon name={rule.categoryIcon} size={17} color={theme.accent} />
                      ) : (
                        <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                      )}
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
        </ScrollView>
      )}
      <Modal
        visible={granularityOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGranularityOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setGranularityOpen(false)}
          accessibilityLabel="Fermer"
        >
          <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.sheetTitle, { color: theme.label }]}>Période</Text>
            {GRANULARITY_OPTIONS.map((option) => {
              const selected = granularity === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setGranularity(option.value);
                    setGranularityOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.granularityRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={{
                      color: theme.label,
                      flex: 1,
                      fontWeight: selected ? "700" : "500",
                    }}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Check size={18} strokeWidth={2.4} color={theme.accent} />
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerArrow: {
    padding: spacing.xs,
  },
  headerArrowDisabled: {
    opacity: 0.3,
  },
  headerLabel: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  granularityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
  },
  granularityChipText: {
    fontWeight: "700",
    fontSize: 14,
  },
  typeControl: {
    flexDirection: "row",
    gap: spacing.xs,
    borderRadius: radius.lg,
    padding: 4,
  },
  typeSegment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    borderRadius: radius.lg - 4,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 48,
  },
  pctBadge: {
    minWidth: 46,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pctBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  sheetTitle: {
    fontWeight: "700",
    fontSize: 16,
    paddingBottom: spacing.md,
  },
  granularityRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
});
