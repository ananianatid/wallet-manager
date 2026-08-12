import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, ChevronRight, Landmark, PiggyBank } from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeToSpendCard } from "@/components/safe-to-spend-card";
import { ScreenState } from "@/components/ui";
import { calculateSafeToSpend } from "@/db/cashflow";
import { getDatabase } from "@/db/database";
import { useCurrency } from "@/currency/context";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import { formatAmount, formatDate } from "@/utils/format";
import { userMessage } from "@/utils/user-message";

export default function CashflowScreen() {
  const theme = useTheme();
  const { baseCurrency, lastRefresh, stale } = useCurrency();
  const load = useCallback(async () => {
    const db = await getDatabase();
    return calculateSafeToSpend(db);
  }, []);

  const resource = useAsyncResource(load, "cashflow.load");
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
          message={userMessage(resource.error)}
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

            <View
              style={[
                styles.panel,
                { backgroundColor: withAlpha(theme.accentSurface, "0C") },
              ]}
            >
              <Text
                accessibilityRole="header"
                style={{ color: theme.label, fontSize: 17, fontWeight: "800" }}
              >
                Le calcul
              </Text>
              <Text
                accessibilityRole="text"
                style={{ color: theme.secondaryLabel, lineHeight: 18, paddingVertical: spacing.sm }}
              >
                Disponible estimé = disponible maintenant + revenus prévus − échéances prévues − épargne prévue.
                Les sommes réservées sont déjà retirées du disponible maintenant.
              </Text>
              <View style={[styles.row, { borderBottomColor: theme.separator }]}>
                <Text style={{ color: theme.label }}>Comptes pris en compte</Text>
                <Text style={{ color: theme.label, fontWeight: "700" }}>
                  {data.includedAccountCount} inclus{data.excludedAccountCount > 0 ? ` · ${data.excludedAccountCount} exclus` : ""}
                </Text>
              </View>
              <View style={[styles.row, { borderBottomColor: theme.separator }]}>
                <View style={styles.rowLabel}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.surfaceElevated }]}>
                    <CalendarClock size={16} color={theme.secondaryLabel} />
                  </View>
                  <Text style={{ color: theme.label }}>Disponible maintenant</Text>
                </View>
                <Text style={{ color: theme.label, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                  {formatAmount(data.currentAvailable, baseCurrency)}
                </Text>
              </View>
              {data.overdraft < 0 ? (
                <View style={[styles.row, { borderBottomColor: theme.separator }]}>
                  <View style={styles.rowLabel}>
                    <View style={[styles.rowIcon, { backgroundColor: theme.surfaceElevated }]}>
                      <Landmark size={16} color={theme.expense} />
                    </View>
                    <Text style={{ color: theme.label }}>
                      Découvert{data.overdraftAccountCount > 1 ? "s" : ""} · {data.overdraftAccountCount}{" "}
                      compte{data.overdraftAccountCount > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Text style={{ color: theme.expense, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                    −{formatAmount(Math.abs(data.overdraft), baseCurrency)}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.row, { borderBottomColor: theme.separator }]}>
                <View style={styles.rowLabel}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.surfaceElevated }]}>
                    <ArrowDown size={16} color={theme.expense} />
                  </View>
                  <Text style={{ color: theme.label }}>Échéances prévues</Text>
                </View>
                <Text style={{ color: theme.expense, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
                  −{formatAmount(data.plannedOutflows, baseCurrency)}
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
                  +{formatAmount(data.plannedIncome, baseCurrency)}
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
                    −{formatAmount(data.savings, baseCurrency)}
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

            <View style={{ gap: spacing.xs, paddingHorizontal: spacing.lg }}>
              <Text style={{ color: theme.label, fontWeight: "700" }}>
                Devise de référence : {baseCurrency}
              </Text>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 18 }}>
                {lastRefresh != null
                  ? `Pour les comptes en devise étrangère, taux enregistrés le ${formatDate(lastRefresh)}${stale ? " · hors connexion, taux en cache" : ""}.`
                  : "Aucun taux de change enregistré pour le moment ; les conversions concernées peuvent être indisponibles."}
              </Text>
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
                      accessibilityRole="button"
                      accessibilityLabel={`Voir ${data.suggestion.goalName} et libérer jusqu'à ${formatAmount(data.suggestion.amount, baseCurrency)}`}
                      style={({ pressed }) => [styles.suggestion, { borderColor: theme.separator }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: theme.label, flex: 1 }}>
                        Voir « {data.suggestion.goalName} » · libérer jusqu&apos;à {formatAmount(data.suggestion.amount, baseCurrency)}
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
});
