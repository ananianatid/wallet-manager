import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import { router, useFocusEffect, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { MonthlySummaryCard } from "@/components/safe-to-spend-card";
import { ScreenState } from "@/components/ui";
import { getDatabase } from "@/db/database";
import { getSetting } from "@/db/settings";
import { useCurrency, useCurrencyConverter } from "@/currency/context";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { listTransactions, listTransactionsByRange } from "@/db/transactions";
import { chartColors, radius, spacing, useTheme, withAlpha } from "@/theme";
import { formatAmount, formatMonthLabel } from "@/utils/format";
import {
  categoryChanges,
  categoryBreakdown,
  compareTotals,
  DEFAULT_WEEK_START_DAY,
  dailySeries,
  enumerateMonths,
  getPeriodBounds,
  getWeekBounds,
  monthFromIndex,
  monthIndex,
  monthlySeries,
  parseWeekStartDay,
  totals,
  type CategoryChange,
  type DayPoint,
  type MonthPoint,
  type PeriodGranularity,
  type MonthRef,
  type WeekStartDay,
  type ComparisonMetric,
} from "@/utils/statistics";
import {
  resetTransactionSearch,
  setTransactionSearch,
} from "@/state/transaction-search";

const BAR_HEIGHT = 130;
const BAR_WIDTH = 9;
const BAR_GAP = 3;

type Granularity = PeriodGranularity | "week";

const GRANULARITY_OPTIONS = [
  { value: "month", label: "Mois" },
  { value: "week", label: "Semaine" },
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
  if (granularity === "week") {
    return "Semaine";
  }
  if (granularity === "year") {
    return String(cursor.year);
  }
  return "Toutes les périodes";
}

function isDayPoint(point: DayPoint | MonthPoint): point is DayPoint {
  return "day" in point;
}

function formatSignedAmount(value: number, currency: string): string {
  if (value === 0) {
    return formatAmount(0, currency);
  }
  return `${value > 0 ? "+" : ""}${formatAmount(value, currency)}`;
}

function formatPercent(value: number | null): string {
  if (value == null) {
    return "Nouveau";
  }
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded} %`;
}

function comparisonColor(
  metric: ComparisonMetric,
  kind: "income" | "expense" | "net",
  theme: ReturnType<typeof useTheme>,
): string {
  if (metric.delta === 0) {
    return theme.secondaryLabel;
  }
  const favorable = kind === "expense" ? metric.delta < 0 : metric.delta > 0;
  return favorable ? theme.income : theme.expense;
}

interface ComparisonMetricViewProps {
  label: string;
  metric: ComparisonMetric;
  currency: string;
  kind: "income" | "expense" | "net";
  theme: ReturnType<typeof useTheme>;
}

function ComparisonMetricView({
  label,
  metric,
  currency,
  kind,
  theme,
}: ComparisonMetricViewProps) {
  const color = comparisonColor(metric, kind, theme);
  return (
    <View style={styles.comparisonMetric} accessible accessibilityRole="text">
      <Text style={[styles.comparisonMetricLabel, { color: theme.secondaryLabel }]}>
        {label}
      </Text>
      <Text style={[styles.comparisonMetricValue, { color: theme.label }]}>
        {formatAmount(metric.current, currency)}
      </Text>
      <Text style={[styles.comparisonMetricDelta, { color }]}>
        {formatSignedAmount(metric.delta, currency)} · {formatPercent(metric.percent)}
      </Text>
    </View>
  );
}

interface CategoryChangeRowProps {
  change: CategoryChange;
  type: "income" | "expense";
  currency: string;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}

function CategoryChangeRow({
  change,
  type,
  currency,
  theme,
  onPress,
}: CategoryChangeRowProps) {
  const increase = change.delta > 0;
  const favorable = type === "expense" ? !increase : increase;
  const color = favorable ? theme.income : theme.expense;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${change.categoryName}, ${increase ? "hausse" : "baisse"} de ${formatSignedAmount(change.delta, currency)}`}
      style={({ pressed }) => [styles.changeRow, pressed && styles.pressed]}
    >
      {change.categoryIcon ? (
        <CategoryIcon name={change.categoryIcon} size={18} color={color} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <View style={styles.changeText}>
        <Text style={[styles.changeName, { color: theme.label }]} numberOfLines={1}>
          {change.categoryName}
        </Text>
        <Text style={[styles.changeDetail, { color: theme.secondaryLabel }]}>
          {increase ? "Hausse" : "Baisse"} · {formatPercent(change.percent)}
        </Text>
      </View>
      <View style={styles.changeValues}>
        <Text style={[styles.changeCurrent, { color: theme.label }]}>
          {formatAmount(change.currentTotal, currency)}
        </Text>
        <Text style={[styles.changeDelta, { color }]}>
          {formatSignedAmount(change.delta, currency)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function StatisticsScreen() {
  const theme = useTheme();
  const { baseCurrency } = useCurrency();
  const convert = useCurrencyConverter();
  const now = new Date();
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [cursor, setCursor] = useState<MonthRef>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [weekCursorMs, setWeekCursorMs] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  });
  const [weekStartDay, setWeekStartDay] = useState<WeekStartDay>(
    DEFAULT_WEEK_START_DAY,
  );
  const weekStartDayRef = useRef(weekStartDay);
  const granularityRef = useRef(granularity);
  const [granularityOpen, setGranularityOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [selectedEvolutionIndex, setSelectedEvolutionIndex] = useState<number | null>(null);

  const periodBounds = useMemo(
    () =>
      granularity === "week"
        ? getWeekBounds(weekCursorMs, weekStartDay)
        : getPeriodBounds(granularity, cursor),
    [cursor, granularity, weekCursorMs, weekStartDay],
  );
  const previousPeriodBounds = useMemo(() => {
    if (granularity === "all") {
      return null;
    }
    if (granularity === "week") {
      const previousWeek = new Date(weekCursorMs);
      previousWeek.setDate(previousWeek.getDate() - 7);
      return getWeekBounds(previousWeek.getTime(), weekStartDay);
    }
    const delta = granularity === "month" ? -1 : granularity === "quarter" ? -3 : -12;
    return getPeriodBounds(
      granularity,
      monthFromIndex(monthIndex(cursor) + delta),
    );
  }, [cursor, granularity, weekCursorMs, weekStartDay]);
  const periodKey = `${granularity}:${periodBounds.startMs ?? "all"}:${periodBounds.endMs ?? "all"}:${granularity === "week" ? weekStartDay : ""}`;

  const load = useCallback(async () => {
    const db = await getDatabase();
    if (periodBounds.startMs == null || periodBounds.endMs == null) {
      const rows = await listTransactions(db, { order: "asc" });
      return {
        transactions: rows,
        comparisonTransactions: [],
        periodKey,
        periodStartMs: 0,
        periodEndMs: null,
      };
    }
    const periodStartMs = periodBounds.startMs;
    const periodEndMs = periodBounds.endMs;
    const previousStartMs = previousPeriodBounds?.startMs;
    const previousEndMs = previousPeriodBounds?.endMs;
    const [rows, comparisonTransactions] = await Promise.all([
      listTransactionsByRange(db, periodStartMs, periodEndMs),
      previousStartMs == null || previousEndMs == null
        ? Promise.resolve([])
        : listTransactionsByRange(db, previousStartMs, previousEndMs),
    ]);
    return {
      transactions: rows,
      comparisonTransactions,
      periodKey,
      periodStartMs,
      periodEndMs,
    };
  }, [periodBounds, periodKey, previousPeriodBounds]);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const reloadRef = useRef(reload);
  const previousPeriodKey = useRef(periodKey);
  const transactions = resource.data?.transactions ?? null;
  const comparisonTransactions = resource.data?.comparisonTransactions;
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    weekStartDayRef.current = weekStartDay;
  }, [weekStartDay]);

  useEffect(() => {
    granularityRef.current = granularity;
  }, [granularity]);

  useEffect(() => {
    if (previousPeriodKey.current === periodKey) {
      return;
    }
    previousPeriodKey.current = periodKey;
    setSelectedEvolutionIndex(null);
    void reloadRef.current();
  }, [periodKey]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getDatabase()
        .then((db) => getSetting(db, "week_start_day"))
        .then((value) => {
          if (!cancelled) {
            const nextWeekStartDay = parseWeekStartDay(value);
            if (
              nextWeekStartDay === weekStartDayRef.current ||
              granularityRef.current !== "week"
            ) {
              setWeekStartDay(nextWeekStartDay);
              void reloadRef.current();
            } else {
              setWeekStartDay(nextWeekStartDay);
            }
          }
        })
        .catch(() => {
          if (!cancelled) {
            void reloadRef.current();
          }
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const rows = useMemo(() => transactions ?? [], [transactions]);
  const periodStartMs = resource.data?.periodStartMs ?? 0;
  const periodEndMs = resource.data?.periodEndMs ?? null;
  const periodRows = useMemo(
    () =>
      rows.filter(
        (t) =>
          t.transactionDate >= periodStartMs &&
          (periodEndMs == null || t.transactionDate < periodEndMs),
      ),
    [rows, periodEndMs, periodStartMs],
  );
  const previousRows = useMemo(
    () => comparisonTransactions ?? [],
    [comparisonTransactions],
  );
  const t = useMemo(() => totals(periodRows, convert), [periodRows, convert]);
  const previousTotals = useMemo(
    () => totals(previousRows, convert),
    [convert, previousRows],
  );
  const comparison = useMemo(
    () =>
      previousPeriodBounds == null ? null : compareTotals(t, previousTotals),
    [previousPeriodBounds, previousTotals, t],
  );
  const slices = useMemo(
    () => categoryBreakdown(periodRows, type, convert),
    [periodRows, type, convert],
  );
  const changes = useMemo<CategoryChange[]>(
    () => categoryChanges(periodRows, previousRows, type, convert),
    [periodRows, previousRows, type, convert],
  );
  const months = useMemo(() => {
    if (granularity === "week" || granularity === "month") {
      return [];
    }
    if (granularity !== "all" && periodBounds.startMs != null && periodBounds.endMs != null) {
      const start = new Date(periodBounds.startMs);
      const end = new Date(periodBounds.endMs - 1);
      return enumerateMonths(
        { year: start.getFullYear(), month: start.getMonth() },
        { year: end.getFullYear(), month: end.getMonth() },
      );
    }
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
  }, [granularity, periodBounds.endMs, periodBounds.startMs, periodRows]);
  const evolutionSeries = useMemo(
    () =>
      granularity === "week" || granularity === "month"
        ? dailySeries(periodRows, periodBounds.startMs, periodBounds.endMs, convert)
        : monthlySeries(periodRows, months, convert),
    [convert, granularity, months, periodBounds.endMs, periodBounds.startMs, periodRows],
  );
  const selectedEvolutionPoint =
    evolutionSeries.length > 0
      ? evolutionSeries[
          Math.min(
            selectedEvolutionIndex ?? evolutionSeries.length - 1,
            evolutionSeries.length - 1,
          )
        ]
      : null;
  const evolutionPointLabel = (point: DayPoint | MonthPoint, index: number) => {
    if (isDayPoint(point)) {
      const date = new Date(point.year, point.month, point.day);
      if (granularity === "week") {
        return date
          .toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })
          .replace(".", "");
      }
      return index % 5 === 0 || index === evolutionSeries.length - 1
        ? String(point.day)
        : "";
    }
    return evolutionSeries.length > 24 && index % 3 !== 0 && index !== evolutionSeries.length - 1
      ? ""
      : new Date(point.year, point.month, 1)
          .toLocaleDateString("fr-FR", { month: "short" })
          .replace(".", "");
  };
  const evolutionPointAccessibleLabel = (point: DayPoint | MonthPoint) =>
    isDayPoint(point)
      ? new Date(point.year, point.month, point.day).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : new Date(point.year, point.month, 1).toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        });
  const selectedEvolutionLabel = selectedEvolutionPoint
    ? isDayPoint(selectedEvolutionPoint)
      ? new Date(
          selectedEvolutionPoint.year,
          selectedEvolutionPoint.month,
          selectedEvolutionPoint.day,
        ).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : new Date(
          selectedEvolutionPoint.year,
          selectedEvolutionPoint.month,
          1,
        ).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;
  const navigate = (delta: number) => {
    if (granularity === "week") {
      setWeekCursorMs((current) => {
        const next = new Date(current);
        next.setDate(next.getDate() + delta * 7);
        return next.getTime();
      });
      return;
    }
    setCursor((c) => {
      if (granularity === "month") {
        return monthFromIndex(monthIndex(c) + delta);
      }
      if (granularity === "quarter") {
        return monthFromIndex(monthIndex(c) + 3 * delta);
      }
      return { year: c.year + delta, month: c.month };
    });
  };
  const canNavigate = granularity !== "all";

  const maxBar = Math.max(t.income, t.expense + t.fees, 1);

  const hasActivity = periodRows.length > 0;
  const periodLabel = rangeLabel(granularity, cursor);
  const headerLabel =
    periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);
  const formatWeekLabel = () => {
    if (periodBounds.startMs == null || periodBounds.endMs == null) {
      return "Semaine";
    }
    const startDate = new Date(periodBounds.startMs);
    const endDate = new Date(periodBounds.endMs - 1);
    const startMonth = startDate.toLocaleDateString("fr-FR", { month: "short" });
    const endMonth = endDate.toLocaleDateString("fr-FR", { month: "short" });
    if (
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth()
    ) {
      return `${startDate.getDate()}–${endDate.getDate()} ${endMonth.replace(".", "")} ${endDate.getFullYear()}`;
    }
    return `${startDate.getDate()} ${startMonth.replace(".", "")} ${startDate.getFullYear()} – ${endDate.getDate()} ${endMonth.replace(".", "")} ${endDate.getFullYear()}`;
  };
  const displayPeriodLabel = granularity === "week" ? formatWeekLabel() : periodLabel;
  const topIncreases = changes.filter((change) => change.delta > 0).slice(0, 2);
  const topDecreases = changes.filter((change) => change.delta < 0).slice(0, 2);
  const hasComparisonActivity = (comparisonTransactions?.length ?? 0) > 0;
  const openSearchForCategory = (categoryId: number | null) => {
    const base = resetTransactionSearch();
    setTransactionSearch({
      ...base,
      startDate: periodBounds.startMs,
      endDate: periodBounds.endMs == null ? null : periodBounds.endMs - 1,
      types: [type],
      categoryIds: categoryId == null ? null : [categoryId],
    });
    router.push("/search");
  };
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
                {granularity === "week"
                  ? displayPeriodLabel
                  : headerLabel}
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
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl,
            gap: spacing.lg,
          }}
        >
          <MonthlySummaryCard
            totals={t}
            totalLabel="Total de la période"
            fullWidth
            loading={
              resource.status === "loading" || resource.data?.periodKey !== periodKey
            }
          />

          {comparison ? (
            <View
              style={[styles.card, { backgroundColor: theme.surface }]}
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`Comparaison avec la période précédente. Revenus ${formatSignedAmount(comparison.income.delta, baseCurrency)}. Dépenses ${formatSignedAmount(comparison.expense.delta + comparison.fees.delta, baseCurrency)}. Total net ${formatSignedAmount(comparison.net.delta, baseCurrency)}.`}
            >
              <View style={styles.sectionHeadingRow}>
                <Text style={{ color: theme.label, fontSize: 15, fontWeight: "700" }}>
                  Comparaison
                </Text>
                <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
                  Période précédente
                </Text>
              </View>
              {!hasComparisonActivity ? (
                <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
                  Aucune transaction dans la période précédente : les pourcentages marquent les nouvelles données.
                </Text>
              ) : null}
              <View style={styles.comparisonGrid}>
                <ComparisonMetricView
                  label="Revenus"
                  metric={comparison.income}
                  currency={baseCurrency}
                  kind="income"
                  theme={theme}
                />
                <ComparisonMetricView
                  label="Dépenses"
                  metric={{
                    ...comparison.expense,
                    current: comparison.expense.current + comparison.fees.current,
                    previous: comparison.expense.previous + comparison.fees.previous,
                    delta: comparison.expense.delta + comparison.fees.delta,
                    percent:
                      comparison.expense.previous + comparison.fees.previous === 0
                        ? null
                        : ((comparison.expense.current + comparison.fees.current -
                            comparison.expense.previous - comparison.fees.previous) /
                            (comparison.expense.previous + comparison.fees.previous)) *
                          100,
                  }}
                  currency={baseCurrency}
                  kind="expense"
                  theme={theme}
                />
                <ComparisonMetricView
                  label="Total net"
                  metric={comparison.net}
                  currency={baseCurrency}
                  kind="net"
                  theme={theme}
                />
              </View>
            </View>
          ) : null}

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
                          ? theme.accentSurface
                          : "transparent",
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={{
                        color: selected
                          ? theme.accentSurfaceText
                          : theme.secondaryLabel,
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

          <View
            style={[styles.card, { backgroundColor: theme.accentSurface, gap: spacing.md }]}
          >
            <Text style={{ color: theme.accentSurfaceLabel, fontSize: 13 }}>
              {type === "expense"
                ? "Dépenses par catégorie"
                : "Revenus par catégorie"}
            </Text>
            {slices.length === 0 ? (
              <Text
                style={{
                  color: theme.accentSurfaceLabel,
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
                        `${slice.categoryName}, ${Math.round(slice.pct)} pour cent, ${formatAmount(slice.total, baseCurrency)}`,
                    )
                    .join(". ")}`}
                >
                  <LabeledDonutChart
                    slices={slices.map((s, i) => ({
                      value: s.total,
                      color: chartColors[i % chartColors.length],
                      name: s.categoryName,
                    }))}
                    surfaceColor={theme.accentSurface}
                    labelColor={theme.accentSurfaceText}
                    outlineColor={withAlpha(theme.accentSurfaceLabel, "66")}
                  />
                </View>
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: withAlpha(theme.accentSurfaceLabel, "66"),
                    marginVertical: spacing.sm,
                  }}
                />
                <View style={{ gap: spacing.xs }}>
                  {slices.map((slice, index) => (
                    <Pressable
                      key={slice.categoryName}
                      onPress={() => openSearchForCategory(slice.categoryId)}
                      accessibilityRole="button"
                      accessibilityLabel={`Voir les transactions de ${slice.categoryName}`}
                      style={({ pressed }) => [styles.summaryRow, pressed && styles.pressed]}
                    >
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
                        style={[styles.legendName, { color: theme.accentSurfaceText }]}
                        numberOfLines={1}
                      >
                        {slice.categoryName}
                      </Text>
                      <Text
                        style={[styles.legendAmount, { color: theme.accentSurfaceText }]}
                      >
                        {formatAmount(slice.total, baseCurrency)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>

          {comparison && hasComparisonActivity && changes.length > 0 ? (
            <View style={[styles.card, { backgroundColor: theme.surface, gap: spacing.sm }]}>
              <View style={styles.sectionHeadingRow}>
                <Text style={{ color: theme.label, fontSize: 15, fontWeight: "700" }}>
                  Ce qui change
                </Text>
                <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
                  {type === "expense" ? "Dépenses" : "Revenus"}
                </Text>
              </View>
              {topIncreases.length > 0 ? (
                <View style={styles.changeGroup}>
                  <Text style={[styles.changeGroupLabel, { color: theme.secondaryLabel }]}>
                    En hausse
                  </Text>
                  {topIncreases.map((change) => (
                    <CategoryChangeRow
                      key={`increase-${change.categoryName}`}
                      change={change}
                      type={type}
                      currency={baseCurrency}
                      theme={theme}
                      onPress={() => openSearchForCategory(change.categoryId)}
                    />
                  ))}
                </View>
              ) : null}
              {topDecreases.length > 0 ? (
                <View style={styles.changeGroup}>
                  <Text style={[styles.changeGroupLabel, { color: theme.secondaryLabel }]}>
                    En baisse
                  </Text>
                  {topDecreases.map((change) => (
                    <CategoryChangeRow
                      key={`decrease-${change.categoryName}`}
                      change={change}
                      type={type}
                      currency={baseCurrency}
                      theme={theme}
                      onPress={() => openSearchForCategory(change.categoryId)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View
            style={[styles.card, { backgroundColor: theme.surface, gap: spacing.md }]}
          >
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                Évolution · {displayPeriodLabel}
              </Text>
              {!hasActivity ? (
                <Text style={{ color: theme.secondaryLabel, textAlign: "center", paddingVertical: spacing.lg }}>
                  Aucune activité sur la période. Changez de période ou ajoutez une transaction pour voir l’évolution.
                </Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <View style={styles.evolutionLegend} accessibilityRole="text">
                    <View style={styles.evolutionLegendItem}>
                      <View style={[styles.evolutionLegendDot, { backgroundColor: theme.income }]} />
                      <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>Revenus</Text>
                    </View>
                    <View style={styles.evolutionLegendItem}>
                      <View style={[styles.evolutionLegendDot, { backgroundColor: theme.expense }]} />
                      <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>Dépenses</Text>
                    </View>
                    <Text style={[styles.evolutionUnit, { color: theme.secondaryLabel }]}>Devise : {baseCurrency} · frais inclus</Text>
                  </View>
                  {selectedEvolutionPoint && selectedEvolutionLabel ? (
                    <View
                      style={[styles.evolutionDetail, { backgroundColor: theme.surfaceElevated }]}
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={`${selectedEvolutionLabel}. Revenus ${formatAmount(selectedEvolutionPoint.income, baseCurrency)}. Dépenses ${formatAmount(selectedEvolutionPoint.expense + selectedEvolutionPoint.fees, baseCurrency)}. Total ${formatAmount(selectedEvolutionPoint.net, baseCurrency)}.`}
                    >
                      <Text style={{ color: theme.label, fontWeight: "700" }}>
                        {selectedEvolutionLabel}
                      </Text>
                      <View style={styles.evolutionDetailValues}>
                        <Text style={{ color: theme.income, fontSize: 12 }}>
                          Revenus {formatAmount(selectedEvolutionPoint.income, baseCurrency)}
                        </Text>
                        <Text style={{ color: theme.expense, fontSize: 12 }}>
                          Dépenses {formatAmount(selectedEvolutionPoint.expense + selectedEvolutionPoint.fees, baseCurrency)}
                        </Text>
                        <Text style={{ color: theme.label, fontSize: 12, fontWeight: "700" }}>
                          Total {formatAmount(selectedEvolutionPoint.net, baseCurrency)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.evolutionScale}>
                    <Text style={{ color: theme.secondaryLabel, fontSize: 11 }}>0</Text>
                    <Text style={{ color: theme.secondaryLabel, fontSize: 11 }}>
                      max. {formatAmount(maxBar, baseCurrency)}
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={evolutionSeries.length > 12}>
                    <View style={styles.barsRow}>
                      {evolutionSeries.map((point, index) => (
                        <Pressable
                          key={`${point.year}-${point.month}-${"day" in point ? point.day : "month"}`}
                          style={styles.barGroup}
                          onPress={() => setSelectedEvolutionIndex(index)}
                          accessibilityRole="button"
                          accessibilityLabel={`${evolutionPointAccessibleLabel(point)}. Revenus ${formatAmount(point.income, baseCurrency)}. Dépenses ${formatAmount(point.expense + point.fees, baseCurrency)}. Total ${formatAmount(point.net, baseCurrency)}.`}
                          accessibilityState={{ selected: selectedEvolutionIndex === index }}
                        >
                          <View style={styles.barPair}>
                            <View
                              style={{
                                width: BAR_WIDTH,
                                height: Math.max(
                                  (point.income / maxBar) * BAR_HEIGHT,
                                  point.income > 0 ? 2 : 0,
                                ),
                                backgroundColor: theme.income,
                                borderRadius: 3,
                              }}
                            />
                            <View
                              style={{
                                width: BAR_WIDTH,
                                height: Math.max(
                                  ((point.expense + point.fees) / maxBar) * BAR_HEIGHT,
                                  point.expense + point.fees > 0 ? 2 : 0,
                                ),
                                backgroundColor: theme.expense,
                                borderRadius: 3,
                              }}
                            />
                          </View>
                          <Text style={[styles.monthLabel, { color: theme.secondaryLabel }]}>
                            {evolutionPointLabel(point, index)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>

        </ScrollView>
      )}
      <Modal
        visible={granularityOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setGranularityOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.scrim }]}
          onPress={() => setGranularityOpen(false)}
          accessibilityLabel="Fermer"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}
          >
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
                  accessibilityRole="radio"
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
    minHeight: 35,
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
    minHeight: 48,
    borderRadius: radius.lg - 4,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  comparisonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.lg,
  },
  comparisonMetric: {
    width: "50%",
    gap: 2,
  },
  comparisonMetricLabel: {
    fontSize: 12,
  },
  comparisonMetricValue: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  comparisonMetricDelta: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  changeGroup: {
    gap: spacing.xs,
  },
  changeGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
  },
  changeText: {
    flex: 1,
    gap: 2,
  },
  changeName: {
    fontWeight: "600",
  },
  changeDetail: {
    fontSize: 12,
  },
  changeValues: {
    alignItems: "flex-end",
    gap: 2,
  },
  changeCurrent: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  changeDelta: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
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
    width: 44,
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
  evolutionLegend: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  evolutionLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  evolutionLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  evolutionUnit: {
    marginLeft: "auto",
    fontSize: 11,
  },
  evolutionDetail: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  evolutionDetailValues: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  evolutionScale: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  backdrop: {
    flex: 1,
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
