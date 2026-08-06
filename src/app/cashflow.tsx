import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, ChevronRight, PiggyBank } from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeToSpendCard } from "@/components/safe-to-spend-card";
import { ScreenState } from "@/components/ui";
import { calculateSafeToSpend } from "@/db/cashflow";
import { getDatabase } from "@/db/database";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import { formatAmount, formatDate } from "@/utils/format";

export default function CashflowScreen() {
  const theme = useTheme();
  const load = useCallback(async () => {
    const db = await getDatabase();
    return calculateSafeToSpend(db);
  }, []);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const data = resource.data;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <>
      <Stack.Screen options={{ title: "Dépenses sûres" }} />
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
        contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {data ? (
          <>
            <SafeToSpendCard data={data} interactive={false} />

            <View style={[styles.panel, { backgroundColor: theme.surface }]}>
              <Text style={{ color: theme.label, fontSize: 17, fontWeight: "800" }}>
                Le calcul
              </Text>
              <View style={[styles.row, { borderBottomColor: theme.separator }]}>
                <View style={styles.rowLabel}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.surfaceElevated }]}>
                    <CalendarClock size={16} color={theme.secondaryLabel} />
                  </View>
                  <Text style={{ color: theme.label }}>Disponible maintenant</Text>
                </View>
                <Text style={{ color: theme.label, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                  {formatAmount(data.currentAvailable)}
                </Text>
              </View>
              <View style={[styles.row, { borderBottomColor: theme.separator }]}>
                <View style={styles.rowLabel}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.surfaceElevated }]}>
                    <ArrowDown size={16} color={theme.expense} />
                  </View>
                  <Text style={{ color: theme.label }}>Échéances prévues</Text>
                </View>
                <Text style={{ color: theme.expense, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                  −{formatAmount(data.plannedOutflows)}
                </Text>
              </View>
              <View style={[styles.row, { borderBottomColor: theme.separator }]}>
                <View style={styles.rowLabel}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.surfaceElevated }]}>
                    <ArrowUp size={16} color={theme.income} />
                  </View>
                  <Text style={{ color: theme.label }}>Revenus prévus</Text>
                </View>
                <Text style={{ color: theme.income, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                  +{formatAmount(data.plannedIncome)}
                </Text>
              </View>
              {data.savings > 0 ? (
                <View style={[styles.row, { borderBottomColor: theme.separator }]}>
                  <View style={styles.rowLabel}>
                    <View style={[styles.rowIcon, { backgroundColor: theme.surfaceElevated }]}>
                      <PiggyBank size={16} color={theme.accent} />
                    </View>
                    <Text style={{ color: theme.label }}>Épargne</Text>
                  </View>
                  <Text style={{ color: theme.accent, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                    −{formatAmount(data.savings)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.horizon}>
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                  Horizon du calcul
                </Text>
                <Text style={{ color: theme.label, fontWeight: "600" }}>
                  {data.usesFallbackHorizon ? "30 prochains jours" : `Prochain revenu · ${formatDate(data.horizonDate)}`}
                </Text>
              </View>
            </View>

            {data.amount < 0 ? (
              <View style={[styles.warning, { backgroundColor: `${theme.expense}16` }]}>
                <AlertTriangle size={18} color={theme.expense} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={{ color: theme.expense, fontWeight: "800" }}>À régulariser</Text>
                  <Text style={{ color: theme.secondaryLabel, lineHeight: 18 }}>
                    Les échéances prévues dépassent le disponible. Une réservation d&apos;objectif peut être libérée manuellement.
                  </Text>
                  {data.suggestion ? (
                    <Pressable
                      onPress={() => router.push({ pathname: "/goals/[id]", params: { id: String(data.suggestion!.goalId) } })}
                      style={({ pressed }) => [styles.suggestion, { borderColor: theme.separator }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: theme.label, flex: 1 }}>
                        Voir « {data.suggestion.goalName} » · libérer jusqu&apos;à {formatAmount(data.suggestion.amount)}
                      </Text>
                      <ChevronRight size={17} color={theme.secondaryLabel} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 18, paddingHorizontal: spacing.lg }}>
              Les objectifs sont déjà retirés du solde disponible.{" "}
              {data.savings > 0
                ? "La cible d'épargne est retirée du disponible estimé."
                : "Les budgets restent des plafonds et ne sont pas comptés comme des dépenses certaines."}
            </Text>
          </>
        ) : null}
      </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  rowIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  horizon: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
});
