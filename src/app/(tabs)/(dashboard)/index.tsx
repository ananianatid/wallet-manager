import { Fragment, type ReactNode } from "react";
import { Plus } from "lucide-react-native";
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
import { CategoryIcon } from "@/components/category-icons";
import { EmptyState } from "@/components/empty-state";
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
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import { formatAmount, formatDate, formatMonthLabel } from "@/utils/format";
import { userMessage } from "@/utils/user-message";
import { savingsByRule, totals } from "@/utils/statistics";

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
        <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
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
  const { baseCurrency, lastRefresh, stale } = useCurrency();
  const convert = useCurrencyConverter();
  const insets = useSafeAreaInsets();

  const currentMonth = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      label: start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      startMs: start.getTime(),
      endMs: end.getTime(),
    };
  }, []);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [forecast, accounts, goals, budgets, savingsRules] = await Promise.all([
      calculateSafeToSpend(db),
      listAccounts(db),
      listGoals(db),
      listBudgets(db),
      listSavingsRules(db),
    ]);
    const ruleStarts = savingsRules
      .map((rule) => rule.startDate)
      .filter((date): date is number => date != null);
    const transactionStartMs =
      ruleStarts.length > 0
        ? Math.min(currentMonth.startMs, ...ruleStarts)
        : currentMonth.startMs;
    const [transactions, recent] = await Promise.all([
      listTransactions(db, { startMs: transactionStartMs, order: "asc" }),
      listTransactions(db, { order: "desc", limit: 5 }),
    ]);

    return {
      safeToSpend: forecast,
      accounts,
      goals,
      budgets,
      savingsRules,
      transactions,
      recent,
    };
  }, [currentMonth.startMs]);

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
  const transactions = useMemo(
    () => data?.transactions ?? [],
    [data?.transactions],
  );
  const recent = useMemo(() => data?.recent ?? [], [data?.recent]);

  const monthTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transactionDate >= currentMonth.startMs &&
          transaction.transactionDate < currentMonth.endMs,
      ),
    [transactions, currentMonth],
  );
  const monthTotals = useMemo(() => totals(monthTransactions, convert), [monthTransactions, convert]);
  const spentByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const transaction of monthTransactions) {
      if (transaction.type === "expense" && transaction.categoryId != null) {
        map.set(
          transaction.categoryId,
          (map.get(transaction.categoryId) ?? 0) +
            (convert(transaction.amount, transaction.accountCurrencyCode ?? baseCurrency) ?? 0),
        );
      }
    }
    return map;
  }, [baseCurrency, convert, monthTransactions]);
  const budgetRows = useMemo(
    () =>
      budgets.map((budget) => ({
        budget,
        spent:
          budget.categoryId == null
            ? monthTotals.expense
            : (spentByCategory.get(budget.categoryId) ?? 0),
      })),
    [budgets, monthTotals.expense, spentByCategory],
  );
  const earliestSavingsStartMs = useMemo(() => {
    const ruleStarts = savingsRules
      .map((rule) => rule.startDate)
      .filter((date): date is number => date != null);
    return ruleStarts.length > 0
      ? Math.min(currentMonth.startMs, ...ruleStarts)
      : currentMonth.startMs;
  }, [savingsRules, currentMonth.startMs]);
  const savingsTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) => transaction.transactionDate >= earliestSavingsStartMs,
      ),
    [transactions, earliestSavingsStartMs],
  );
  const savings = useMemo(
    () => savingsByRule(savingsTransactions, savingsRules, currentMonth.startMs, convert),
    [savingsTransactions, savingsRules, currentMonth.startMs, convert],
  );
  const savingsTitle = useMemo(
    () =>
      earliestSavingsStartMs < currentMonth.startMs
        ? `Épargne · depuis ${formatMonthLabel(
            new Date(earliestSavingsStartMs).getFullYear(),
            new Date(earliestSavingsStartMs).getMonth(),
          )}`
        : `Épargne · ${currentMonth.label}`,
    [earliestSavingsStartMs, currentMonth],
  );
  const savingsTotal = useMemo(
    () => savings.reduce((sum, contribution) => sum + contribution.amount, 0),
    [savings],
  );

  const activeGoals = useMemo(
    () => goals.filter((goal) => !goal.isAchieved).slice(0, 3),
    [goals],
  );

  const openNew = () => router.push("/new-transaction");

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
                  title={`Budgets · ${formatAmount(monthTotals.expense, baseCurrency)} dépensés`}
                  action={{
                    label: "Gérer",
                    onPress: () => router.push("/budgets"),
                  }}
                >
                  {budgetRows.map(({ budget, spent }) => {
                    const pct = Math.min((spent / budget.amount) * 100, 100);
                    const over = spent > budget.amount;
                    const color = over
                      ? theme.expense
                      : spent >= budget.amount * 0.8
                        ? theme.warning
                        : theme.accent;
                    return (
                      <View key={budget.id} style={{ gap: spacing.xs }}>
                        <View style={styles.budgetRow}>
                          {budget.categoryIcon ? (
                            <CategoryIcon name={budget.categoryIcon} size={17} color={theme.accent} />
                          ) : null}
                          <Text style={[styles.legendName, { color: theme.label }]} numberOfLines={2}>
                            {budget.categoryName ?? "Toutes les dépenses"}
                          </Text>
                          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                            {Math.round((spent / budget.amount) * 100)}%
                          </Text>
                          <Text style={{ color: theme.label, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                            {formatAmount(spent, baseCurrency)} / {formatAmount(budget.amount, budget.currencyCode)}
                          </Text>
                        </View>
                        <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
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
                </SectionCard>
              ) : null}

              <SectionCard
                title={savingsTitle}
                tone="accent"
                action={{
                  label: "Gérer",
                  onPress: () => router.push("/savings"),
                }}
              >
                {savings.length === 0 ? (
                  <Text style={{ color: theme.secondaryLabel, lineHeight: 20 }}>
                    Aucune règle d&apos;épargne configurée pour le moment.
                  </Text>
                ) : (
                  <>
                    <View style={{ gap: spacing.sm }}>
                      {savings.map(({ rule, amount }) => (
                        <View key={rule.id} style={styles.legendRow}>
                          {rule.categoryIcon ? (
                            <CategoryIcon name={rule.categoryIcon} size={17} color={theme.accent} />
                          ) : null}
                          <Text style={[styles.legendName, { color: theme.label }]} numberOfLines={2}>
                            {rule.categoryName ?? "Tous les revenus"}
                          </Text>
                          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                            {rule.percent} %
                          </Text>
                          <Text style={[styles.legendAmount, { color: theme.label }]}>
                            {formatAmount(amount, baseCurrency)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={[styles.savingsTotal, { borderTopColor: theme.separator }]}>
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
                        {formatAmount(savingsTotal, baseCurrency)}
                      </Text>
                    </View>
                  </>
                )}
              </SectionCard>

              {activeGoals.length > 0 ? (
              <SectionCard
                title="Objectifs en cours"
                tone="accent"
                action={{
                    label: "Tout voir",
                    onPress: () => router.push("/goals"),
                  }}
                >
                  {activeGoals.map((goal) => {
                    const statusColor = goal.isOverdue
                      ? theme.expense
                      : theme.accent;
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
                        style={({ pressed }) => [
                          { gap: spacing.xs },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[styles.legendName, { color: theme.label }]}
                          numberOfLines={1}
                        >
                          {goal.name}
                        </Text>
                        <View style={styles.goalBarRow}>
                          <View
                            style={[
                              styles.goalTrack,
                              { backgroundColor: theme.surfaceElevated },
                            ]}
                          >
                            <View
                              style={{
                                width: `${goal.progressPercent}%`,
                                height: "100%",
                                borderRadius: radius.md,
                                backgroundColor: statusColor,
                              }}
                            />
                          </View>
                          <Text
                            style={[styles.goalPercent, { color: statusColor }]}
                          >
                            {goal.progressPercent}%
                          </Text>
                        </View>
                        <View style={styles.goalAmountRow}>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: theme.label,
                              fontWeight: "700",
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {formatAmount(goal.reservedAmount, goal.currencyCode)} /{" "}
                            {formatAmount(goal.targetAmount, goal.currencyCode)}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ color: theme.secondaryLabel, fontSize: 12 }}
                          >
                            {" · reste "}
                            {formatAmount(goal.remainingAmount, goal.currencyCode)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
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
                    <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
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
            pressed && { opacity: 0.8 },
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
  legendName: {
    flex: 1,
    fontWeight: "600",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 36,
  },
  legendAmount: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  budgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  goalBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  goalTrack: {
    flex: 1,
    height: 12,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  goalPercent: {
    width: 44,
    textAlign: "right",
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  goalAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  savingsTotal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
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
