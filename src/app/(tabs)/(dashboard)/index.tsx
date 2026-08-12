import { Fragment, type ReactNode } from "react";
import { ChevronRight, Plus } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
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
import { MiniDonut } from "@/components/mini-donut";
import { ProgressRing } from "@/components/progress-ring";
import { SafeToSpendCard } from "@/components/safe-to-spend-card";
import { TransactionRow } from "@/components/transaction-row";
import { ScreenState } from "@/components/ui";
import { listAccounts } from "@/db/accounts";
import { listBudgets } from "@/db/budgets";
import { calculateSafeToSpend } from "@/db/cashflow";
import { getDatabase } from "@/db/database";
import { useCurrency, useCurrencyConverter } from "@/currency/context";
import { listGoals } from "@/db/goals";
import { listSavingsRules } from "@/db/savings";
import { listTransactions } from "@/db/transactions";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { chartColors, radius, spacing, useTheme, withAlpha } from "@/theme";
import { budgetProgress, topCategorySlices, urgentGoals } from "@/utils/dashboard";
import { formatAmount, formatDate } from "@/utils/format";
import { categoryBreakdown } from "@/utils/statistics";
import { userMessage } from "@/utils/user-message";

function SectionCard({
  title,
  action,
  tone = "neutral",
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  tone?: "neutral" | "accent";
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor:
            tone === "accent" ? withAlpha(theme.accentSurface, "12") : theme.surface,
          gap: spacing.md,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text
          accessibilityRole="header"
          style={{ color: theme.label, fontSize: 15, fontWeight: "700" }}
        >
          {title}
        </Text>
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [styles.cardAction, pressed && styles.pressed]}
          >
            <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { lastRefresh, stale, baseCurrency } = useCurrency();
  const convert = useCurrencyConverter();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const db = await getDatabase();
    const now = new Date();
    const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endMs = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const [forecast, accounts, goals, budgets, savingsRules, monthTx, recent] =
      await Promise.all([
        calculateSafeToSpend(db),
        listAccounts(db),
        listGoals(db),
        listBudgets(db),
        listSavingsRules(db),
        listTransactions(db, { startMs, endMs, order: "asc" }),
        listTransactions(db, { order: "desc", limit: 5 }),
      ]);

    return {
      safeToSpend: forecast,
      accounts,
      goals,
      budgets,
      savingsRules,
      monthTx,
      recent,
    };
  }, []);

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
  const monthTx = useMemo(() => data?.monthTx ?? [], [data?.monthTx]);

  const { spentByCategory, totalExpense } = useMemo(() => {
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
    return { spentByCategory: map, totalExpense: total };
  }, [monthTx, convert, baseCurrency]);

  const budgetRows = useMemo(
    () => budgetProgress(budgets, spentByCategory, totalExpense),
    [budgets, spentByCategory, totalExpense],
  );
  const topGoals = useMemo(() => urgentGoals(goals), [goals]);
  const topSlices = useMemo(
    () => topCategorySlices(categoryBreakdown(monthTx, "expense", convert)),
    [monthTx, convert],
  );

  const openNew = () => router.push("/new-transaction");
  const openEdit = (id: number) =>
    router.push({ pathname: "/new-transaction", params: { id: String(id) } });

  const sliceColor = (index: number) =>
    index < 4 ? chartColors[index] : theme.secondaryLabel;

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
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingTop: insets.top + spacing.md,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl + 56 + insets.bottom + spacing.lg,
            gap: spacing.lg,
          }}
        >
          {!hasAccounts ? (
            <EmptyState
              title="Commencez par créer un compte"
              message="Les transactions sont enregistrées sur un compte."
              actionLabel="Créer un compte"
              onAction={() => router.push("/(tabs)/(accounts)")}
            />
          ) : (
            <>
              {lastRefresh != null ? (
                <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
                  Taux actuels du {formatDate(lastRefresh)}{stale ? " · hors connexion" : ""}
                </Text>
              ) : null}
              {safeToSpend ? (
                // SafeToSpendCard porte son propre marginHorizontal: annule celui-ci
                // pour rester aligné avec les autres cards (conteneur paddé).
                <View style={{ marginHorizontal: -spacing.lg }}>
                  <SafeToSpendCard
                    data={safeToSpend}
                    compact
                    onPress={() => router.push("/cashflow")}
                  />
                </View>
              ) : null}

              {budgetRows.length > 0 ? (
                <SectionCard
                  title="Budgets"
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
                              { color: theme.secondaryLabel },
                            ]}
                          >
                            {formatAmount(row.spent, baseCurrency)} /{" "}
                            {formatAmount(row.budget.amount, row.budget.currencyCode)}
                          </Text>
                        </View>
                        <View
                          accessible
                          accessibilityRole="progressbar"
                          accessibilityLabel={`${formatAmount(row.spent, baseCurrency)} dépensés sur ${formatAmount(row.budget.amount, row.budget.currencyCode)}`}
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
                </SectionCard>
              ) : null}

              {topGoals.length > 0 || savingsRules.length > 0 ? (
                <SectionCard
                  title="Objectifs"
                  action={{
                    label: "Tout voir",
                    onPress: () => router.push("/goals"),
                  }}
                >
                  {topGoals.length > 0 ? (
                    <View style={styles.goalsRow}>
                      {topGoals.map((goal) => {
                        const overdue = goal.isOverdue;
                        const ringColor = overdue ? theme.expense : theme.accent;
                        const cardSurface = overdue
                          ? withAlpha(theme.expense, "12")
                          : withAlpha(theme.accentSurface, "12");
                        return (
                          <Pressable
                            key={goal.id}
                            onPress={() =>
                              router.push({
                                pathname: "/goals/[id]",
                                params: { id: String(goal.id) },
                              })
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`${goal.name}. ${Math.round(goal.progressPercent)} % atteints.`}
                            accessibilityHint="Ouvre le détail de l’objectif."
                            style={({ pressed }) => [
                              styles.goalCard,
                              { backgroundColor: cardSurface },
                              pressed && styles.pressed,
                            ]}
                          >
                            <ProgressRing
                              progress={goal.progressPercent}
                              color={ringColor}
                              trackColor={withAlpha(theme.label, "16")}
                              labelColor={theme.label}
                              accessibilityLabel={`${goal.name} : ${Math.round(goal.progressPercent)} %`}
                            />
                            <Text
                              numberOfLines={1}
                              style={[styles.goalName, { color: theme.label }]}
                            >
                              {goal.name}
                            </Text>
                            <Text style={[styles.goalDetail, { color: theme.secondaryLabel }]}>
                              Cible le {formatDate(goal.targetDate)}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={[styles.goalAmount, { color: theme.label }]}
                            >
                              {formatAmount(goal.reservedAmount, goal.currencyCode)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
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
                          ? `${savingsRules.length} règle${savingsRules.length > 1 ? "s" : ""} active${savingsRules.length > 1 ? "s" : ""}`
                          : "Mettre automatiquement de côté"}
                      </Text>
                    </View>
                    <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
                  </Pressable>
                </SectionCard>
              ) : null}

              {topSlices.length > 0 ? (
                <SectionCard
                  title="Top catégories"
                  action={{
                    label: "Statistiques",
                    onPress: () => router.push("/(tabs)/(statistics)"),
                  }}
                >
                  <View style={styles.topCategoriesRow}>
                    <MiniDonut
                      slices={topSlices.map((s, index) => ({
                        value: s.total,
                        color: sliceColor(index),
                      }))}
                      trackColor={theme.surfaceElevated}
                    />
                    <View style={styles.topCategoriesLegend}>
                      {topSlices.map((s, index) => (
                        <View key={s.categoryName} style={styles.topCategoryLine}>
                          <CategoryIcon
                            name={s.categoryIcon}
                            size={16}
                            color={sliceColor(index)}
                          />
                          <Text
                            numberOfLines={1}
                            style={[styles.topCategoryName, { color: theme.label }]}
                          >
                            {s.categoryName}
                          </Text>
                          <Text
                            style={[styles.topCategoryPct, { color: theme.secondaryLabel }]}
                          >
                            {Math.round(s.pct)} %
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[styles.topCategoryAmount, { color: theme.label }]}
                          >
                            {formatAmount(s.total, baseCurrency)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </SectionCard>
              ) : null}

              {recent.length > 0 ? (
                <View
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: radius.lg,
                    overflow: "hidden",
                  }}
                >
                  <View style={styles.recentHeader}>
                    <Text
                      accessibilityRole="header"
                      style={{ color: theme.label, fontSize: 15, fontWeight: "700" }}
                    >
                      Transactions récentes
                    </Text>
                    <Pressable
                      onPress={() => router.push("/(tabs)/(transactions)")}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.cardAction, pressed && styles.pressed]}
                    >
                      <Text
                        style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}
                      >
                        Tout voir
                      </Text>
                    </Pressable>
                  </View>
                  {recent.map((t, index) => (
                    <Fragment key={t.id}>
                      <TransactionRow
                        transaction={t}
                        hideDate
                        onPress={() => openEdit(t.id)}
                      />
                      {index < recent.length - 1 ? (
                        <View
                          style={{
                            height: StyleSheet.hairlineWidth,
                            backgroundColor: theme.separator,
                            marginLeft: spacing.lg + 22,
                            marginRight: spacing.lg,
                          }}
                        />
                      ) : null}
                    </Fragment>
                  ))}
                  <View style={{ height: spacing.sm }} />
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
      {hasAccounts ? (
        <Pressable
          onPress={openNew}
          accessibilityLabel="Ajouter une transaction"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: theme.accent,
              bottom: insets.bottom + spacing.lg,
              boxShadow: `0 4px 12px ${withAlpha(theme.label, "59")}`,
            },
            pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
          ]}
        >
          <Plus size={30} strokeWidth={2.5} color={theme.onAccent} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  cardAction: {
    minHeight: 48,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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
    fontWeight: "700",
  },
  planningDetail: {
    fontSize: 13,
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
    fontWeight: "600",
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
  goalsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  goalCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.sm,
  },
  goalName: {
    fontWeight: "700",
    fontSize: 13,
    maxWidth: "100%",
  },
  goalDetail: {
    fontSize: 11,
  },
  goalAmount: {
    fontWeight: "800",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    maxWidth: "100%",
  },
  topCategoriesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  topCategoriesLegend: {
    flex: 1,
    gap: spacing.sm,
  },
  topCategoryLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  topCategoryName: {
    flex: 1,
    fontSize: 13,
  },
  topCategoryPct: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  topCategoryAmount: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
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
  },
});
