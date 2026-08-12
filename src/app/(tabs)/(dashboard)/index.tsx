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
import { SafeToSpendCard } from "@/components/safe-to-spend-card";
import { TransactionRow } from "@/components/transaction-row";
import { ScreenState } from "@/components/ui";
import { listAccounts } from "@/db/accounts";
import { listBudgets } from "@/db/budgets";
import { calculateSafeToSpend } from "@/db/cashflow";
import { getDatabase } from "@/db/database";
import { useCurrency } from "@/currency/context";
import { listGoals } from "@/db/goals";
import { listSavingsRules } from "@/db/savings";
import { listTransactions } from "@/db/transactions";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import { formatDate } from "@/utils/format";
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
  const { lastRefresh, stale } = useCurrency();
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [forecast, accounts, goals, budgets, savingsRules] = await Promise.all([
      calculateSafeToSpend(db),
      listAccounts(db),
      listGoals(db),
      listBudgets(db),
      listSavingsRules(db),
    ]);
    const recent = await listTransactions(db, { order: "desc", limit: 5 });

    return {
      safeToSpend: forecast,
      accounts,
      goals,
      budgets,
      savingsRules,
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
  const activeGoalsCount = useMemo(
    () => goals.filter((goal) => !goal.isAchieved).length,
    [goals],
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

              <SectionCard title="Planifier">
                <Pressable
                  onPress={() => router.push("/budgets")}
                  accessibilityRole="button"
                  accessibilityLabel="Budgets"
                  accessibilityHint="Ouvrir les budgets"
                  style={({ pressed }) => [styles.planningRow, pressed && styles.pressed]}
                >
                  <View style={styles.planningCopy}>
                    <Text style={[styles.planningTitle, { color: theme.label }]}>Budgets</Text>
                    <Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>
                      {budgets.length > 0
                        ? `${budgets.length} budget${budgets.length > 1 ? "s" : ""} configuré${budgets.length > 1 ? "s" : ""}`
                        : "Fixer des limites de dépenses"}
                    </Text>
                  </View>
                  <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
                </Pressable>
                <Pressable
                  onPress={() => router.push("/savings")}
                  accessibilityRole="button"
                  accessibilityLabel="Épargne"
                  accessibilityHint="Ouvrir les règles d’épargne"
                  style={({ pressed }) => [styles.planningRow, pressed && styles.pressed]}
                >
                  <View style={styles.planningCopy}>
                    <Text style={[styles.planningTitle, { color: theme.label }]}>Épargne</Text>
                    <Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>
                      {savingsRules.length > 0
                        ? `${savingsRules.length} règle${savingsRules.length > 1 ? "s" : ""} active${savingsRules.length > 1 ? "s" : ""}`
                        : "Mettre automatiquement de côté"}
                    </Text>
                  </View>
                  <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
                </Pressable>
                <Pressable
                  onPress={() => router.push("/goals")}
                  accessibilityRole="button"
                  accessibilityLabel="Objectifs"
                  accessibilityHint="Ouvrir les objectifs"
                  style={({ pressed }) => [styles.planningRow, pressed && styles.pressed]}
                >
                  <View style={styles.planningCopy}>
                    <Text style={[styles.planningTitle, { color: theme.label }]}>Objectifs</Text>
                    <Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>
                      {activeGoalsCount > 0
                        ? `${activeGoalsCount} objectif${activeGoalsCount > 1 ? "s" : ""} en cours`
                        : "Préparer un projet à financer"}
                    </Text>
                  </View>
                  <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
                </Pressable>
              </SectionCard>

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
