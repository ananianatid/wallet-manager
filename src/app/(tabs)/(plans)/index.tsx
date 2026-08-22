import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  PiggyBank,
  RefreshCcw,
  Target,
} from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenState } from "@/components/ui";
import { loadPlansSnapshot } from "@/data/plans";
import { useCurrency, useCurrencyConverter } from "@/currency/context";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { type BudgetProgressRow } from "@/utils/dashboard";
import { goalTotals } from "@/utils/goals";
import { formatAmount } from "@/utils/format";
import { radius, spacing, typography, useTheme, withAlpha } from "@/theme";

function PlanRow({
  icon: Icon,
  title,
  detail,
  onPress,
  accent,
}: {
  icon: typeof Target;
  title: string;
  detail: string;
  onPress: () => void;
  accent?: string;
}) {
  const theme = useTheme();
  const color = accent ?? theme.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      style={({ pressed }) => [styles.planRow, pressed && styles.pressed]}
    >
      <View style={[styles.planIcon, { backgroundColor: withAlpha(color, "18") }]}>
        <Icon size={19} strokeWidth={2.1} color={color} />
      </View>
      <View style={styles.planCopy}>
        <Text style={[styles.planTitle, { color: theme.label }]}>{title}</Text>
        <Text style={[styles.planDetail, { color: theme.secondaryLabel }]} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
    </Pressable>
  );
}

function BudgetRows({ rows, currency }: { rows: BudgetProgressRow[]; currency: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: theme.surface }]}>
      {rows.map((row, index) => (
        <View key={row.budget.id} style={styles.budgetRow}>
          <View style={styles.budgetCopy}>
            <View style={styles.budgetHeading}>
              <Text style={[styles.planTitle, { color: theme.label }]} numberOfLines={1}>
                {row.budget.categoryName ?? "Toutes les dépenses"}
              </Text>
              <Text style={[styles.budgetAmount, { color: row.over ? theme.expense : theme.secondaryLabel }]}>
                {formatAmount(row.spent, currency)} / {formatAmount(row.budget.amount, row.budget.currencyCode)}
              </Text>
            </View>
            <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(row.pct) }} style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
              <View style={[styles.fill, { width: `${row.pct}%`, backgroundColor: row.over ? theme.expense : theme.accent }]} />
            </View>
          </View>
          {index < rows.length - 1 ? <View style={[styles.separator, { backgroundColor: theme.separator }]} /> : null}
        </View>
      ))}
    </View>
  );
}

export default function PlansScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { baseCurrency } = useCurrency();
  const convert = useCurrencyConverter();
  const load = useCallback(
    () => loadPlansSnapshot(baseCurrency, convert),
    [baseCurrency, convert],
  );

  const resource = useAsyncResource(load, "plans.load");
  const reload = resource.reload;
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const data = resource.data;
  const activeGoals = useMemo(() => data?.goals.filter((goal) => goal.status === "active") ?? [], [data?.goals]);
  const activeSavings = useMemo(() => data?.savingsRules ?? [], [data?.savingsRules]);
  const activeRecurring = useMemo(() => data?.recurring.filter((rule) => rule.isActive) ?? [], [data?.recurring]);
  const pendingOccurrences = data?.pendingOccurrences ?? [];
  const totals = useMemo(() => goalTotals(activeGoals, convert), [activeGoals, convert]);
  const budgetRows = data?.budgetRows ?? [];
  const overBudgetCount = budgetRows.filter((row) => row.over).length;

  return (
    <>
      {!data ? (
        <ScreenState status={resource.status === "error" ? "error" : "loading"} message={resource.status === "error" ? "Les plans n’ont pas pu être chargés." : undefined} onRetry={() => void resource.reload()} />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        >
          <View style={[styles.snapshot, { backgroundColor: theme.accentSurface }]} accessible accessibilityRole="summary">
            <Text style={[styles.snapshotLabel, { color: theme.accentSurfaceLabel }]}>ENGAGEMENTS ACTIFS</Text>
            <Text style={[styles.snapshotValue, { color: theme.accentSurfaceText }]}>{budgetRows.length + activeGoals.length + activeSavings.length + activeRecurring.length}</Text>
            <Text style={[styles.snapshotBody, { color: theme.accentSurfaceLabel }]}>éléments qui donnent une direction à votre argent</Text>
            <View style={[styles.snapshotFooter, { borderTopColor: withAlpha(theme.accentSurfaceLabel, "55") }]}>
              <Text style={{ color: theme.accentSurfaceIncome }}>{activeGoals.length > 0 ? `${formatAmount(totals.remaining, baseCurrency)} à réserver` : "Aucun objectif actif"}</Text>
              <Text style={{ color: overBudgetCount > 0 ? theme.accentSurfaceExpense : theme.accentSurfaceLabel }}>{overBudgetCount > 0 ? `${overBudgetCount} budget${overBudgetCount > 1 ? "s" : ""} dépassé${overBudgetCount > 1 ? "s" : ""}` : "Budgets à jour"}</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.label }]}>Ce mois</Text>
            <Text style={[styles.sectionHint, { color: theme.secondaryLabel }]}>Dépenses par rapport aux plafonds</Text>
          </View>
          {budgetRows.length > 0 ? <BudgetRows rows={budgetRows.slice(0, 4)} currency={baseCurrency} /> : <PlanRow icon={Target} title="Créer un budget" detail="Fixez un plafond par catégorie pour savoir où vous en êtes." onPress={() => router.push("/budgets")} />}
          {budgetRows.length > 4 ? <Pressable onPress={() => router.push("/budgets")} style={styles.moreLink}><Text style={{ color: theme.accent, fontWeight: "700" }}>Voir les {budgetRows.length} budgets</Text></Pressable> : null}

          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.label }]}>À construire</Text>
            <Text style={[styles.sectionHint, { color: theme.secondaryLabel }]}>Vos prochaines réserves</Text>
          </View>
          <View style={[styles.list, { backgroundColor: theme.surface }]}>
            <PlanRow icon={Target} title="Objectifs" detail={activeGoals.length > 0 ? `${activeGoals.length} actif${activeGoals.length > 1 ? "s" : ""} · ${formatAmount(totals.reserved, baseCurrency)} déjà réservé` : "Donnez un montant et une date à un projet."} onPress={() => router.push("/goals")} />
            <View style={[styles.separator, { backgroundColor: theme.separator }]} />
            <PlanRow icon={PiggyBank} title="Épargne automatique" detail={activeSavings.length > 0 ? `${activeSavings.length} règle${activeSavings.length > 1 ? "s" : ""} active${activeSavings.length > 1 ? "s" : ""}` : "Mettez de côté un pourcentage de vos revenus."} onPress={() => router.push("/savings")} />
          </View>

          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.label }]}>À automatiser</Text>
            <Text style={[styles.sectionHint, { color: theme.secondaryLabel }]}>Ne plus ressaisir le prévisible</Text>
          </View>
          <View style={[styles.list, { backgroundColor: theme.surface }]}>
            <PlanRow icon={RefreshCcw} title="Transactions récurrentes" detail={pendingOccurrences.length > 0 ? `${pendingOccurrences.length} échéance${pendingOccurrences.length > 1 ? "s" : ""} à valider` : activeRecurring.length > 0 ? `${activeRecurring.length} règle${activeRecurring.length > 1 ? "s" : ""} active${activeRecurring.length > 1 ? "s" : ""}` : "Programmez les revenus, dépenses et transferts réguliers."} onPress={() => router.push("/recurring")} />
            <View style={[styles.separator, { backgroundColor: theme.separator }]} />
            <PlanRow icon={BarChart3} title="Analyses" detail="Comparez vos périodes pour ajuster vos décisions." onPress={() => router.push("/(tabs)/(statistics)" )} />
            <View style={[styles.separator, { backgroundColor: theme.separator }]} />
            <PlanRow icon={CalendarClock} title="Calendrier" detail={`La semaine commence le jour choisi dans les réglages.`} onPress={() => router.push("/calendar-settings")} />
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + 24, gap: spacing.md },
  snapshot: { padding: spacing.lg, borderRadius: radius.xl, gap: spacing.xs, borderCurve: "continuous" },
  snapshotLabel: { ...typography.label, letterSpacing: 0.6 },
  snapshotValue: { ...typography.amount, marginTop: spacing.xs },
  snapshotBody: typography.body,
  snapshotFooter: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, marginTop: spacing.md },
  sectionHeader: { gap: 2, marginTop: spacing.md },
  sectionTitle: typography.section,
  sectionHint: typography.label,
  list: { borderRadius: radius.xl, overflow: "hidden" },
  planRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  planIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  planCopy: { flex: 1, gap: 2 },
  planTitle: { ...typography.section, fontSize: 15, lineHeight: 20 },
  planDetail: { ...typography.label, fontWeight: "400" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg + 38 + spacing.md },
  budgetRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  budgetCopy: { gap: spacing.sm },
  budgetHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  budgetAmount: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  moreLink: { alignSelf: "flex-end", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  pressed: { opacity: 0.65 },
});
