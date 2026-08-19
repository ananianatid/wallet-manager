import { Fragment, useCallback, useMemo, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  Plus,
} from "lucide-react-native";
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
import { listAccounts } from "@/db/accounts";
import { listBudgets } from "@/db/budgets";
import { calculateSafeToSpend } from "@/db/cashflow";
import { getDatabase } from "@/db/database";
import { useCurrency, useCurrencyConverter } from "@/currency/context";
import { listGoals } from "@/db/goals";
import { listSavingsRules } from "@/db/savings";
import { listTransactions } from "@/db/transactions";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, typography, useTheme, withAlpha } from "@/theme";
import { budgetProgress } from "@/utils/dashboard";
import { formatAmount, formatDate, formatDayLabel, formatTime } from "@/utils/format";
import { savingsByRule } from "@/utils/statistics";
import { userMessage } from "@/utils/user-message";
import { goalTotals } from "@/utils/goals";
import type { Transaction } from "@/types";

interface RecentDayGroup {
  key: string;
  title: string;
  data: Transaction[];
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

function QuickAction({
  label,
  color,
  icon,
  onPress,
}: {
  label: string;
  color: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label === "Dépense" ? "Ajouter une dépense" : `Ajouter un ${label.toLowerCase()}`}
      style={({ pressed }) => [
        styles.quickAction,
        { backgroundColor: theme.surface, borderColor: theme.separator },
        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: withAlpha(color, "1A") }]}>
        {icon}
      </View>
      <Text style={[styles.quickActionLabel, { color: theme.label }]}>{label}</Text>
    </Pressable>
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
    const nowMs = now.getTime();
    const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endMs = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const [
      forecast,
      accounts,
      goals,
      budgets,
      savingsRules,
      monthTx,
      allTransactions,
      recent,
      upcoming,
    ] =
      await Promise.all([
        calculateSafeToSpend(db),
        listAccounts(db),
        listGoals(db),
        listBudgets(db),
        listSavingsRules(db),
        listTransactions(db, { startMs, endMs, order: "asc" }),
        listTransactions(db, { order: "asc" }),
        listTransactions(db, { endMs: nowMs, order: "desc", limit: 5 }),
        listTransactions(db, { startMs: nowMs, order: "asc", limit: 3 }),
      ]);

    const savingsTotal = savingsByRule(allTransactions, savingsRules, 0, convert).reduce(
      (sum, contribution) => sum + contribution.amount,
      0,
    );

    return {
      safeToSpend: forecast,
      accounts,
      goals,
      budgets,
      savingsRules,
      monthTx,
      recent,
      upcoming,
      savingsTotal,
    };
  }, [convert]);

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
  const savingsTotal = data?.savingsTotal ?? 0;
  const totals = useMemo(() => goalTotals(goals, convert), [convert, goals]);
  const recentGroups = useMemo(() => groupTransactionsByDay(recent), [recent]);
  const upcomingGroups = useMemo(() => groupTransactionsByDay(upcoming), [upcoming]);

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

  const openNew = () => router.push("/new-transaction");
  const openEdit = (id: number) =>
    router.push({ pathname: "/new-transaction", params: { id: String(id) } });

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
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl + 104 + insets.bottom + spacing.lg,
            gap: spacing.xl,
          }}
        >
          <View style={styles.screenHeader}>
            <View style={styles.screenHeaderCopy}>
              <Text accessibilityRole="header" style={[styles.screenTitle, { color: theme.label }]}>
                Aujourd’hui
              </Text>
              <Text style={[styles.screenSubtitle, { color: theme.secondaryLabel }]}>
                Votre argent, en ordre de marche.
              </Text>
            </View>
            {lastRefresh != null ? (
              <Text style={[styles.refreshLabel, { color: theme.secondaryLabel }]}>
                Mis à jour le {formatDate(lastRefresh)} à {formatTime(lastRefresh)}{stale ? " · hors connexion" : ""}
              </Text>
            ) : null}
          </View>
          {!hasAccounts ? (
            <EmptyState
              title="Commencez par créer un compte"
              message="Les transactions sont enregistrées sur un compte."
              actionLabel="Créer un compte"
              onAction={() => router.push("/(tabs)/(accounts)")}
            />
          ) : (
            <>
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

              <View
                style={styles.quickActions}
                accessibilityRole="toolbar"
                accessibilityLabel="Actions rapides"
              >
                <QuickAction
                  label="Dépense"
                  color={theme.expense}
                  icon={<ArrowDownLeft size={18} strokeWidth={2.4} color={theme.expense} />}
                  onPress={() => router.push({ pathname: "/new-transaction", params: { type: "expense" } })}
                />
                <QuickAction
                  label="Revenu"
                  color={theme.income}
                  icon={<ArrowUpRight size={18} strokeWidth={2.4} color={theme.income} />}
                  onPress={() => router.push({ pathname: "/new-transaction", params: { type: "income" } })}
                />
                <QuickAction
                  label="Transfert"
                  color={theme.accent}
                  icon={<ArrowLeftRight size={18} strokeWidth={2.4} color={theme.accent} />}
                  onPress={() => router.push({ pathname: "/new-transaction", params: { type: "transfer" } })}
                />
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
                    <View key={group.key} style={styles.recentDayGroup}>
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
                            onPress={() => openEdit(transaction.id)}
                          />
                          {index < group.data.length - 1 ? (
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
                    <View key={group.key} style={styles.recentDayGroup}>
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
                            onPress={() => openEdit(transaction.id)}
                          />
                          {index < group.data.length - 1 ? (
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
      {hasAccounts ? (
        <Pressable
          onPress={openNew}
          accessibilityLabel="Ajouter une transaction"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: theme.accent,
              bottom: insets.bottom + 88,
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
  screenHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  screenHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  screenTitle: {
    ...typography.display,
  },
  screenSubtitle: {
    ...typography.body,
  },
  refreshLabel: {
    maxWidth: 132,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "right",
  },
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  quickActionIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "700",
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
    gap: spacing.xs,
  },
  recentDayHeader: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentDayTitle: {
    fontSize: 12,
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
