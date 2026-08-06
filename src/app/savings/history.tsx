import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenState } from "@/components/ui";
import { getDatabase } from "@/db/database";
import { listSavingsRules } from "@/db/savings";
import { listTransactions } from "@/db/transactions";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { enumerateMonths, monthlySavingsBreakdown } from "@/utils/statistics";
import { formatAmount, formatMonthLabel } from "@/utils/format";
import { radius, spacing, useTheme } from "@/theme";

const MONTH_COUNT = 12;

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function SavingsHistoryScreen() {
  const theme = useTheme();

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [rules, transactions] = await Promise.all([
      listSavingsRules(db),
      listTransactions(db, { order: "asc" }),
    ]);
    return { rules, transactions };
  }, []);

  const resource = useAsyncResource(load);
  const reload = resource.reload;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const months = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - MONTH_COUNT + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    return enumerateMonths(
      { year: start.getFullYear(), month: start.getMonth() },
      { year: end.getFullYear(), month: end.getMonth() },
    );
  }, []);

  const breakdown = useMemo(
    () =>
      resource.data
        ? monthlySavingsBreakdown(resource.data.transactions, resource.data.rules, months)
        : [],
    [months, resource.data],
  );
  const total = breakdown.reduce((sum, month) => sum + month.total, 0);
  const subtractableTotal = breakdown.reduce(
    (sum, month) => sum + month.subtractableTotal,
    0,
  );

  return (
    <>
      <Stack.Screen options={{ title: "Suivi de l’épargne" }} />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={resource.error?.message}
          onRetry={() => void resource.reload()}
        />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
        >
          <Text style={[styles.intro, { color: theme.secondaryLabel }]}>
            Voici l’épargne estimée à partir de vos revenus des 12 derniers mois.
            Les règles informatives sont visibles sans réduire le disponible estimé.
          </Text>

          <View style={[styles.summary, { backgroundColor: theme.surface }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.secondaryLabel }]}>
                Total estimé
              </Text>
              <Text selectable style={[styles.summaryAmount, { color: theme.label }]}>
                {formatAmount(total)}
              </Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.separator }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.secondaryLabel }]}>
                Retiré du disponible
              </Text>
              <Text selectable style={[styles.summaryAmount, { color: theme.accent }]}>
                {formatAmount(subtractableTotal)}
              </Text>
            </View>
          </View>

          {breakdown
            .slice()
            .reverse()
            .map((month) => {
              const visibleContributions = month.contributions.filter(
                (contribution) => contribution.amount > 0,
              );
              return (
                <View
                  key={`${month.year}-${month.month}`}
                  style={[styles.monthCard, { backgroundColor: theme.surface }]}
                >
                  <View style={styles.monthHeader}>
                    <Text style={[styles.monthTitle, { color: theme.label }]}>
                      {capitalise(formatMonthLabel(month.year, month.month))}
                    </Text>
                    <Text selectable style={[styles.monthAmount, { color: theme.accent }]}>
                      {formatAmount(month.subtractableTotal)} retirés
                    </Text>
                  </View>
                  <Text style={[styles.monthTotal, { color: theme.secondaryLabel }]}>
                    {formatAmount(month.total)} estimés au total
                  </Text>

                  {visibleContributions.length === 0 ? (
                    <Text style={[styles.emptyMonth, { color: theme.secondaryLabel }]}>
                      Aucun revenu concerné ce mois-ci.
                    </Text>
                  ) : (
                    <View style={styles.contributions}>
                      {visibleContributions.map(({ rule, amount }) => (
                        <View key={rule.id} style={styles.contributionRow}>
                          <View style={styles.contributionBody}>
                            <Text style={[styles.contributionName, { color: theme.label }]}>
                              {rule.categoryName ?? "Tous les revenus"}
                            </Text>
                            <Text style={[styles.contributionStatus, { color: rule.subtractFromAvailable ? theme.accent : theme.secondaryLabel }]}>
                              {rule.subtractFromAvailable
                                ? "Retirée du disponible"
                                : "Informatif uniquement"}
                            </Text>
                          </View>
                          <Text selectable style={[styles.contributionAmount, { color: theme.label }]}>
                            {formatAmount(amount)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  intro: {
    lineHeight: 20,
  },
  summary: {
    flexDirection: "row",
    alignItems: "stretch",
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  summaryItem: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
  },
  monthCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  monthTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
  },
  monthAmount: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  monthTotal: {
    fontSize: 13,
  },
  contributions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  contributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  contributionBody: {
    flex: 1,
    gap: 2,
  },
  contributionName: {
    fontWeight: "600",
  },
  contributionStatus: {
    fontSize: 12,
  },
  contributionAmount: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  emptyMonth: {
    fontSize: 13,
    paddingTop: spacing.xs,
  },
});
