import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PieChart } from "@/components/pie-chart";
import { getDatabase } from "@/db/database";
import { listTransactionsByRange } from "@/db/transactions";
import { chartColors, radius, spacing, useTheme } from "@/theme";
import type { Transaction } from "@/types";
import { formatAmount, formatMonthLabel } from "@/utils/format";
import {
  enumerateMonths,
  expenseByCategory,
  monthlySeries,
  totals,
  type MonthRef,
} from "@/utils/statistics";

const BAR_HEIGHT = 130;
const BAR_WIDTH = 9;
const BAR_GAP = 3;

interface RangeStepperProps {
  label: string;
  ref_: MonthRef;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}

function RangeStepper({
  label,
  ref_,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: RangeStepperProps) {
  const theme = useTheme();
  return (
    <View style={styles.rangeRow}>
      <Text style={{ color: theme.secondaryLabel, fontSize: 13, width: 40 }}>
        {label}
      </Text>
      <Pressable
        onPress={onPrev}
        disabled={prevDisabled}
        hitSlop={10}
        style={[styles.arrow, prevDisabled && { opacity: 0.3 }]}
      >
        <Text style={[styles.arrowText, { color: theme.accent }]}>‹</Text>
      </Pressable>
      <Text
        style={[
          styles.rangeLabel,
          { color: theme.label, textTransform: "capitalize" },
        ]}
        numberOfLines={1}
      >
        {formatMonthLabel(ref_.year, ref_.month)}
      </Text>
      <Pressable
        onPress={onNext}
        disabled={nextDisabled}
        hitSlop={10}
        style={[styles.arrow, nextDisabled && { opacity: 0.3 }]}
      >
        <Text style={[styles.arrowText, { color: theme.accent }]}>›</Text>
      </Pressable>
    </View>
  );
}

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

  const load = useCallback(async () => {
    const db = await getDatabase();
    const startMs = new Date(start.year, start.month, 1).getTime();
    const endMs = new Date(end.year, end.month + 1, 1).getTime();
    setTransactions(await listTransactionsByRange(db, startMs, endMs));
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

  const shiftStart = (delta: number) => {
    const d = new Date(start.year, start.month + delta, 1);
    setStart({ year: d.getFullYear(), month: d.getMonth() });
    if (d.getFullYear() * 12 + d.getMonth() > end.year * 12 + end.month) {
      setEnd({ year: d.getFullYear(), month: d.getMonth() });
    }
  };

  const shiftEnd = (delta: number) => {
    const d = new Date(end.year, end.month + delta, 1);
    setEnd({ year: d.getFullYear(), month: d.getMonth() });
    if (d.getFullYear() * 12 + d.getMonth() < start.year * 12 + start.month) {
      setStart({ year: d.getFullYear(), month: d.getMonth() });
    }
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
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
        gap: spacing.lg,
      }}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, gap: spacing.xs },
        ]}
      >
        <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
          Période
        </Text>
        <RangeStepper
          label="Du"
          ref_={start}
          onPrev={() => shiftStart(-1)}
          onNext={() => shiftStart(1)}
        />
        <RangeStepper
          label="Au"
          ref_={end}
          onPrev={() => shiftEnd(-1)}
          onNext={() => shiftEnd(1)}
        />
      </View>

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
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  arrow: {
    paddingHorizontal: spacing.sm,
  },
  arrowText: {
    fontSize: 22,
    fontWeight: "600",
  },
  rangeLabel: {
    flex: 1,
    fontWeight: "700",
    fontSize: 15,
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
