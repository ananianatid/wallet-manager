import { Fragment, useCallback, useMemo } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/empty-state";
import { CategoryIcon } from "@/components/category-icons";
import { SafeToSpendCard } from "@/components/safe-to-spend-card";
import { TransactionRow } from "@/components/transaction-row";
import { ContentSection, ScreenState } from "@/components/ui";
import { MotionEntrance } from "@/components/motion";
import { listBudgets } from "@/db/budgets";
import {
  calculateSafeToSpendFromInputs,
  loadSafeToSpendInputs,
} from "@/db/cashflow";
import { getDatabase } from "@/db/database";
import { useCurrency, useCurrencyConverter } from "@/currency/context";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { useScrollPerformance } from "@/hooks/use-scroll-performance";
import { isPerformanceProfilingEnabled } from "@/services/performance";
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import { budgetProgress, dashboardInsight } from "@/utils/dashboard";
import {
  dashboardMetricTone,
  financialToneColor,
} from "@/utils/financial-display";
import { formatAmount, formatDayLabel, formatShortDate } from "@/utils/format";
import { savingsByRule } from "@/utils/statistics";
import { userMessage } from "@/utils/user-message";
import { goalTotals } from "@/utils/goals";
import type { Transaction } from "@/types";

interface RecentDayGroup {
  key: string;
  title: string;
  data: Transaction[];
}

function DashboardStatCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${label} : ${value}`}
      style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.separator }]}
    >
      <Text style={[styles.statLabel, { color: theme.secondaryLabel }]}>{label}</Text>
      <Text selectable numberOfLines={1} style={[styles.statValue, { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

function groupTransactionsByDay(transactions: Transaction[]): RecentDayGroup[] {
  const groups = new Map<string, RecentDayGroup>();
  for (const transaction of transactions) {
    const date = new Date(transaction.transactionDate);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const group = groups.get(key) ?? {
      key,
      title: formatDayLabel(transaction.transactionDate),
      data: [],
    };
    group.data.push(transaction);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { baseCurrency, rates } = useCurrency();
  const convert = useCurrencyConverter();
  const onScroll = useScrollPerformance("dashboard.scroll");
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const db = await getDatabase();
    const now = new Date();
    const nowMs = now.getTime();
    const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endMs = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const [inputs, budgets] = await Promise.all([
      loadSafeToSpendInputs(db, nowMs, {
        referenceCurrency: baseCurrency,
        currencyRates: rates,
      }),
      listBudgets(db),
    ]);
    const allTransactions = [...inputs.transactions].reverse();
    const monthTx = inputs.transactions
      .filter(
        (transaction) =>
          transaction.transactionDate >= startMs &&
          transaction.transactionDate < endMs,
      )
      .reverse();
    const previousMonthTx = inputs.transactions
      .filter(
        (transaction) =>
          transaction.transactionDate >= previousMonthStart &&
          transaction.transactionDate < startMs,
      )
      .reverse();
    const recent = inputs.transactions
      .filter((transaction) => transaction.transactionDate < nowMs)
      .slice(0, 5);
    const upcoming = inputs.transactions
      .filter((transaction) => transaction.transactionDate >= nowMs)
      .reverse()
      .slice(0, 3);

    const savingsTotal = savingsByRule(allTransactions, inputs.savingsRules, 0, convert).reduce(
      (sum, contribution) => sum + contribution.amount,
      0,
    );

    return {
      safeToSpend: calculateSafeToSpendFromInputs(inputs, nowMs),
      accounts: inputs.accountsRows,
      goals: inputs.goals,
      budgets,
      savingsRules: inputs.savingsRules,
      monthTx,
      previousMonthTx,
      recent,
      upcoming,
      savingsTotal,
    };
  }, [baseCurrency, convert, rates]);

  const resource = useAsyncResource(load, "dashboard.load");
  const reload = resource.reload;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const data = resource.data;
  const accounts = useMemo(() => data?.accounts ?? [], [data?.accounts]);
  const hasAccounts = accounts.length > 0;
  const safeToSpend = data?.safeToSpend ?? null;
  const goals = useMemo(() => data?.goals ?? [], [data?.goals]);
  const budgets = useMemo(() => data?.budgets ?? [], [data?.budgets]);
  const savingsRules = useMemo(
    () => data?.savingsRules ?? [],
    [data?.savingsRules],
  );
  const recent = useMemo(() => data?.recent ?? [], [data?.recent]);
  const upcoming = useMemo(() => data?.upcoming ?? [], [data?.upcoming]);
  const monthTx = useMemo(() => data?.monthTx ?? [], [data?.monthTx]);
  const previousMonthTx = useMemo(() => data?.previousMonthTx ?? [], [data?.previousMonthTx]);
  const savingsTotal = data?.savingsTotal ?? 0;
  const totals = useMemo(() => goalTotals(goals, convert), [convert, goals]);
  const recentGroups = useMemo(() => groupTransactionsByDay(recent), [recent]);
  const upcomingGroups = useMemo(() => groupTransactionsByDay(upcoming), [upcoming]);

  const { spentByCategory, totalExpense, previousMonthExpense } = useMemo(() => {
    const map = new Map<number, number>();
    let total = 0;
    for (const t of monthTx) {
      if (t.type !== "expense") {
        continue;
      }
      const converted = convert(t.amount, t.accountCurrencyCode ?? baseCurrency) ?? 0;
      total += converted;
      if (t.categoryId != null) {
        map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + converted);
      }
    }
    const previousTotal = previousMonthTx.reduce((sum, transaction) => {
      if (transaction.type !== "expense") {
        return sum;
      }
      return sum + (convert(transaction.amount, transaction.accountCurrencyCode ?? baseCurrency) ?? 0);
    }, 0);
    return {
      spentByCategory: map,
      totalExpense: total,
      previousMonthExpense: previousTotal,
    };
  }, [baseCurrency, convert, monthTx, previousMonthTx]);

  const budgetRows = useMemo(
    () => budgetProgress(budgets, spentByCategory, totalExpense),
    [budgets, spentByCategory, totalExpense],
  );
  const budgetRemaining = useMemo(() => {
    if (budgetRows.length === 0) {
      return null;
    }
    return budgetRows.reduce((sum, row) => {
      const budgetAmount = convert(row.budget.amount, row.budget.currencyCode) ?? row.budget.amount;
      return sum + Math.max(budgetAmount - row.spent, 0);
    }, 0);
  }, [budgetRows, convert]);
  const insight = useMemo(
    () =>
      dashboardInsight({
        totalExpense,
        previousMonthExpense,
        hasCurrentActivity: monthTx.length > 0,
        hasPreviousActivity: previousMonthTx.length > 0,
        budgetRemaining,
        hasOverBudget: budgetRows.some((row) => row.over),
      }),
    [
      budgetRemaining,
      budgetRows,
      monthTx.length,
      previousMonthExpense,
      previousMonthTx.length,
      totalExpense,
    ],
  );
  const expenseColor = financialToneColor(
    dashboardMetricTone("expense", totalExpense),
    theme,
  );
  const budgetColor = financialToneColor(
    dashboardMetricTone("budgetRemaining", budgetRemaining),
    theme,
  );
  const savingsColor = financialToneColor(
    dashboardMetricTone("savings", savingsTotal),
    theme,
  );
  const upcomingColor = financialToneColor(
    dashboardMetricTone("upcoming", upcoming[0] ? 1 : null),
    theme,
  );

  const openEdit = useCallback(
    (id: number) =>
      router.push({ pathname: "/new-transaction", params: { id: String(id) } }),
    [],
  );

  return (
    <View style={{ flex: 1 }}>
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={userMessage(resource.error)}
          onRetry={() => void resource.reload()}
        />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          onScroll={isPerformanceProfilingEnabled() ? onScroll : undefined}
          scrollEventThrottle={isPerformanceProfilingEnabled() ? 16 : undefined}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl + 104 + insets.bottom + spacing.lg,
            gap: spacing.xl,
          }}
        >
          {!hasAccounts ? (
            <EmptyState
              title="Ajoutez votre premier compte financier"
              message="Ajoutez une banque, une caisse ou un portefeuille mobile pour enregistrer vos transactions."
              actionLabel="Ajouter un compte financier"
              onAction={() => router.push("/(tabs)/(accounts)")}
            />
          ) : (
            <>
              {safeToSpend ? (
                // SafeToSpendCard porte son propre marginHorizontal: annule celui-ci
                // pour rester aligné avec les autres cards (conteneur paddé).
                <MotionEntrance style={{ marginHorizontal: -spacing.lg }}>
                  <SafeToSpendCard
                    data={safeToSpend}
                    compact
                    onPress={() => router.push("/cashflow")}
                  />
                </MotionEntrance>
              ) : null}

              <View style={styles.statsGrid}>
                <View style={styles.statsRow}>
                  <DashboardStatCard
                    label="Dépenses ce mois"
                    value={formatAmount(totalExpense, baseCurrency)}
                    valueColor={expenseColor}
                  />
                  <DashboardStatCard
                    label="Budget restant"
                    value={budgetRemaining == null ? "—" : formatAmount(budgetRemaining, baseCurrency)}
                    valueColor={budgetColor}
                  />
                </View>
                <View style={styles.statsRow}>
                  <DashboardStatCard
                    label="Épargne"
                    value={formatAmount(savingsTotal, baseCurrency)}
                    valueColor={savingsColor}
                  />
                  <DashboardStatCard
                    label="Prochaine échéance"
                    value={upcoming[0] ? formatShortDate(upcoming[0].transactionDate) : "—"}
                    valueColor={upcomingColor}
                  />
                </View>
              </View>

              <View
                accessible
                accessibilityRole="summary"
                accessibilityLabel={`Insight : ${insight.title}. ${insight.body}`}
                style={[
                  styles.insightCard,
                  {
                    backgroundColor: withAlpha(
                      insight.level === "warning" ? theme.expense : theme.income,
                      "18",
                    ),
                  },
                ]}
              >
                {insight.level === "warning" ? (
                  <AlertTriangle
                    accessibilityLabel="Alerte financière"
                    size={18}
                    color={theme.expense}
                  />
                ) : null}
                <View style={styles.insightCopy}>
                  <Text
                    style={[
                      styles.insightTitle,
                      { color: insight.level === "warning" ? theme.expense : theme.label },
                    ]}
                  >
                    {insight.title}
                  </Text>
                  <Text style={[styles.insightBody, { color: theme.secondaryLabel }]}>
                    {insight.body}
                  </Text>
                </View>
              </View>

              {budgetRows.length > 0 ? (
                <ContentSection
                  title="Budgets du mois"
                  action={{
                    label: "Tout voir",
                    onPress: () => router.push("/budgets"),
                  }}
                >
                  {budgetRows.map((row) => (
                    <View key={row.budget.id} style={styles.budgetRow}>
                      {row.budget.categoryIcon ? (
                        <View
                          style={[
                            styles.budgetIcon,
                            { backgroundColor: theme.surfaceElevated },
                          ]}
                        >
                          <CategoryIcon
                            name={row.budget.categoryIcon}
                            size={18}
                            color={theme.accent}
                          />
                        </View>
                      ) : null}
                      <View style={styles.budgetBody}>
                        <View style={styles.budgetHeader}>
                          <Text
                            numberOfLines={1}
                            style={[styles.budgetTitle, { color: theme.label }]}
                          >
                            {row.budget.categoryName ?? "Toutes les dépenses"}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.budgetAmount,
                              { color: row.over ? theme.expense : theme.secondaryLabel },
                            ]}
                          >
                            {formatAmount(row.spent, baseCurrency)} /{" "}
                            {formatAmount(row.budget.amount, row.budget.currencyCode)}
                          </Text>
                        </View>
                        <View
                          accessible
                          accessibilityRole="progressbar"
                          accessibilityLabel={`${row.budget.categoryName ?? "Toutes les dépenses"} : ${formatAmount(row.spent, baseCurrency)} dépensés sur ${formatAmount(row.budget.amount, row.budget.currencyCode)}`}
                          style={[
                            styles.budgetTrack,
                            { backgroundColor: theme.surfaceElevated },
                          ]}
                        >
                          <View
                            style={{
                              width: `${row.pct}%`,
                              height: "100%",
                              borderRadius: radius.md,
                              backgroundColor: row.over ? theme.expense : theme.accent,
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </ContentSection>
              ) : null}

              {goals.length > 0 || savingsRules.length > 0 ? (
                <ContentSection
                  title="Vos plans"
                  action={{
                    label: "Tout voir",
                    onPress: () => router.push("/(tabs)/(plans)"),
                  }}
                >
                  {goals.length > 0 ? (
                    <Pressable
                      onPress={() => router.push("/goals")}
                      accessibilityRole="button"
                      accessibilityLabel={`Total des objectifs : ${formatAmount(totals.target, baseCurrency)}`}
                      accessibilityHint="Ouvre les objectifs"
                      style={({ pressed }) => [styles.planningRow, pressed && styles.pressed]}
                    >
                      <View style={styles.planningCopy}>
                        <Text style={[styles.planningTitle, { color: theme.label }]}>Objectifs</Text>
                        <Text
                          style={[styles.planningDetail, { color: theme.secondaryLabel }]}
                        >
                          {formatAmount(totals.target, baseCurrency)}
                        </Text>
                      </View>
                      <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => router.push("/savings")}
                    accessibilityRole="button"
                    accessibilityLabel="Épargne"
                    accessibilityHint="Ouvrir les règles d’épargne"
                    style={({ pressed }) => [styles.planningRow, pressed && styles.pressed]}
                  >
                    <View style={styles.planningCopy}>
                      <Text style={[styles.planningTitle, { color: theme.label }]}>
                        Épargne
                      </Text>
                      <Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>
                        {savingsRules.length > 0
                          ? `${savingsRules.length} règle${savingsRules.length > 1 ? "s" : ""} active${savingsRules.length > 1 ? "s" : ""} · Total épargné depuis le début : ${formatAmount(savingsTotal, baseCurrency)}`
                          : "Mettre automatiquement de côté"}
                      </Text>
                    </View>
                    <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
                  </Pressable>
                </ContentSection>
              ) : null}

              {recentGroups.length > 0 ? (
                <ContentSection
                  title="Derniers mouvements"
                  action={{
                    label: "Tout voir",
                    onPress: () => router.push("/(tabs)/(transactions)"),
                  }}
                >
                  {recentGroups.map((group) => (
                    <View
                      key={group.key}
                      style={[styles.recentDayGroup, { backgroundColor: theme.surface, borderColor: theme.separator }]}
                    >
                      <View
                        style={[
                          styles.recentDayHeader,
                          { borderBottomColor: theme.separator },
                        ]}
                      >
                        <Text
                          style={[styles.recentDayTitle, { color: theme.secondaryLabel }]}
                        >
                          {group.title}
                        </Text>
                      </View>
                      {group.data.map((transaction, index) => (
                        <Fragment key={transaction.id}>
                          <TransactionRow
                            transaction={transaction}
                            hideDate
                            onPress={openEdit}
                          />
                          {index < group.data.length - 1 ? (
                            <View
                              style={{
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: theme.separator,
                              }}
                            />
                          ) : null}
                        </Fragment>
                      ))}
                    </View>
                  ))}
                </ContentSection>
              ) : null}

              {upcomingGroups.length > 0 ? (
                <ContentSection
                  title="Prochains mouvements"
                  action={{
                    label: "Tout voir",
                    onPress: () => router.push("/(tabs)/(transactions)"),
                  }}
                >
                  {upcomingGroups.map((group) => (
                    <View
                      key={group.key}
                      style={[styles.recentDayGroup, { backgroundColor: theme.surface, borderColor: theme.separator }]}
                    >
                      <View
                        style={[
                          styles.recentDayHeader,
                          { borderBottomColor: theme.separator },
                        ]}
                      >
                        <Text
                          style={[styles.recentDayTitle, { color: theme.secondaryLabel }]}
                        >
                          {group.title}
                        </Text>
                      </View>
                      {group.data.map((transaction, index) => (
                        <Fragment key={transaction.id}>
                          <TransactionRow
                            transaction={transaction}
                            hideDate
                            onPress={openEdit}
                          />
                          {index < group.data.length - 1 ? (
                            <View
                              style={{
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: theme.separator,
                              }}
                            />
                          ) : null}
                        </Fragment>
                      ))}
                    </View>
                  ))}
                </ContentSection>
              ) : null}

              {!budgets.length || !goals.length || !savingsRules.length ? (
                <ContentSection title="Premiers réglages">
                  {!budgets.length ? (
                    <Pressable
                      onPress={() => router.push("/budgets")}
                      accessibilityRole="button"
                      accessibilityLabel="Créer un budget"
                      accessibilityHint="Ouvre la création d’un budget."
                      style={({ pressed }) => [styles.setupRow, pressed && styles.pressed]}
                    >
                      <View style={styles.planningCopy}>
                        <Text style={[styles.planningTitle, { color: theme.label }]}>Créer un budget</Text>
                        <Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>Suivez vos dépenses par catégorie.</Text>
                      </View>
                      <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
                    </Pressable>
                  ) : null}
                  {!goals.length ? (
                    <Pressable
                      onPress={() => router.push("/goals/new")}
                      accessibilityRole="button"
                      accessibilityLabel="Définir un objectif"
                      accessibilityHint="Ouvre la création d’un objectif."
                      style={({ pressed }) => [styles.setupRow, pressed && styles.pressed]}
                    >
                      <View style={styles.planningCopy}>
                        <Text style={[styles.planningTitle, { color: theme.label }]}>Définir un objectif</Text>
                        <Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>Mettez de côté pour un projet précis.</Text>
                      </View>
                      <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
                    </Pressable>
                  ) : null}
                  {!savingsRules.length ? (
                    <Pressable
                      onPress={() => router.push("/savings")}
                      accessibilityRole="button"
                      accessibilityLabel="Configurer une épargne"
                      accessibilityHint="Ouvre la configuration de l’épargne."
                      style={({ pressed }) => [styles.setupRow, pressed && styles.pressed]}
                    >
                      <View style={styles.planningCopy}>
                        <Text style={[styles.planningTitle, { color: theme.label }]}>Configurer une épargne</Text>
                        <Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>Mettez régulièrement de côté.</Text>
                      </View>
                      <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
                    </Pressable>
                  ) : null}
                </ContentSection>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  planningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.xs,
  },
  planningCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  planningTitle: {
    fontWeight: "500",
  },
  planningDetail: {
    fontSize: 13,
  },
  setupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 56,
    paddingVertical: spacing.xs,
  },
  budgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  budgetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetBody: {
    flex: 1,
    gap: 6,
  },
  budgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  budgetTitle: {
    flex: 1,
    fontWeight: "500",
  },
  budgetAmount: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  budgetTrack: {
    height: 6,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  recentDayGroup: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recentDayHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentDayTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  statsGrid: {
    gap: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 100,
    justifyContent: "space-between",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
    borderCurve: "continuous",
  },
  insightCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  insightBody: {
    fontSize: 13,
    lineHeight: 19,
  },
});
