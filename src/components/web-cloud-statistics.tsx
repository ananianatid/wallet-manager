import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { InlineError } from "@/components/ui";
import { formatAmount } from "@/utils/format";
import { spacing, typography, useTheme } from "@/theme";

function fields(entity: CloudEntity): Record<string, unknown> { return cloudFields(entity); }
function timestamp(entity: CloudEntity): number { const value = Number(fields(entity).transaction_date ?? fields(entity).created_at ?? 0); return value > 0 && value < 10_000_000_000 ? value * 1000 : value; }
function monthKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(key: string): string { const [year, month] = key.split("-").map(Number); return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); }

export default function WebCloudStatistics() {
  const theme = useTheme();
  const [entities, setEntities] = useState<CloudEntity[]>([]);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const result = await loadCloudBootstrap(["transactions", "categories"]); setEntities(result.entities.filter((entity) => entity.payload !== null)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger les statistiques."); }
    finally { setLoading(false); }
  }, []);
  // The first remote load intentionally synchronizes component state after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const transactions = useMemo(() => entities.filter((entity) => entity.entityType === "transactions"), [entities]);
  const categories = useMemo(() => entities.filter((entity) => entity.entityType === "categories"), [entities]);
  const selectedTransactions = useMemo(() => transactions.filter((entity) => monthKey(new Date(timestamp(entity))) === month), [month, transactions]);
  const previousMonth = useMemo(() => { const [year, monthNumber] = month.split("-").map(Number); return monthKey(new Date(year, monthNumber - 2, 1)); }, [month]);
  const previousTransactions = useMemo(() => transactions.filter((entity) => monthKey(new Date(timestamp(entity))) === previousMonth), [previousMonth, transactions]);
  const total = (list: CloudEntity[], type: string) => list.filter((entity) => String(fields(entity).type) === type).reduce((sum, entity) => sum + Number(fields(entity).amount ?? 0), 0);
  const expenseByCategory = useMemo(() => {
    const values = new Map<string, number>();
    selectedTransactions.filter((entity) => fields(entity).type === "expense").forEach((entity) => { const id = cloudRefs(entity).category_id ?? "none"; values.set(id, (values.get(id) ?? 0) + Number(fields(entity).amount ?? 0)); });
    return [...values.entries()].sort((a, b) => b[1] - a[1]);
  }, [selectedTransactions]);
  const monthChoices = useMemo(() => Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - index); return monthKey(date); }), []);
  const expense = total(selectedTransactions, "expense");
  const previousExpense = total(previousTransactions, "expense");
  const delta = previousExpense > 0 ? Math.round(((expense - previousExpense) / previousExpense) * 100) : null;

  if (loading) return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={[styles.stateTitle, { color: theme.label }]}>Chargement des statistiques…</Text></View>;
  if (error) return <View style={[styles.state, { backgroundColor: theme.background }]}><InlineError message={error} onRetry={() => void load()} /></View>;
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}><View style={styles.heading}><View><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>ESPACE CLOUD · ANALYSE</Text><Text style={[styles.title, { color: theme.label }]}>Statistiques</Text><Text style={{ color: theme.secondaryLabel }}>{monthLabel(month)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Actualiser les statistiques" onPress={() => void load()} style={[styles.refresh, { borderColor: theme.separator }]}><RefreshCw size={17} color={theme.accent} /><Text style={{ color: theme.accent, fontWeight: "800" }}>Actualiser</Text></Pressable></View><View style={styles.monthChoices}>{monthChoices.map((choice) => <Pressable key={choice} onPress={() => setMonth(choice)} accessibilityRole="radio" accessibilityState={{ selected: month === choice }} style={[styles.monthChoice, { backgroundColor: month === choice ? theme.accent : theme.surface, borderColor: month === choice ? theme.accent : theme.separator }]}><Text style={{ color: month === choice ? theme.onAccent : theme.label, fontWeight: "700" }}>{monthLabel(choice)}</Text></Pressable>)}</View><View style={styles.metrics}><Metric label="Revenus" value={formatAmount(total(selectedTransactions, "income"), "XOF")} color={theme.income} /><Metric label="Dépenses" value={formatAmount(expense, "XOF")} color={theme.expense} /><Metric label="Transferts" value={formatAmount(total(selectedTransactions, "transfer"), "XOF")} color={theme.accent} /><Metric label="Variation dépenses" value={delta == null ? "Pas de comparaison" : `${delta > 0 ? "+" : ""}${delta}% vs mois précédent`} color={delta != null && delta > 0 ? theme.expense : theme.income} /></View><View style={styles.sectionHeader}><Text style={[styles.section, { color: theme.label }]}>Dépenses par catégorie</Text><Text style={{ color: theme.secondaryLabel }}>{selectedTransactions.length} opération{selectedTransactions.length > 1 ? "s" : ""}</Text></View>{expenseByCategory.length === 0 ? <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={{ color: theme.label, fontWeight: "800" }}>Aucune dépense catégorisée</Text><Text style={{ color: theme.secondaryLabel }}>Enregistrez une dépense avec une catégorie pour éclairer cette période.</Text></View> : expenseByCategory.map(([id, amount]) => { const category = categories.find((item) => item.entityId === id); return <View key={id} style={[styles.row, { borderColor: theme.separator, backgroundColor: theme.surface }]}><View style={styles.rowCopy}><Text style={[styles.rowName, { color: theme.label }]}>{category ? String(fields(category).name ?? "Catégorie") : "Sans catégorie"}</Text><View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}><View style={[styles.fill, { backgroundColor: theme.expense, width: `${expense > 0 ? Math.min(100, (amount / expense) * 100) : 0}%` }]} /></View></View><Text style={[styles.amount, { color: theme.label }]}>{formatAmount(amount, "XOF")}</Text></View>; })}</ScrollView>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) { const theme = useTheme(); return <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.metricLabel, { color }]}>{label}</Text><Text style={[styles.metricValue, { color: theme.label }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.lg, flexWrap: "wrap" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { ...typography.display }, refresh: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14 }, monthChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, monthChoice: { minHeight: 42, justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, metric: { minWidth: 180, flexGrow: 1, padding: spacing.lg, borderWidth: 1, borderRadius: 16, gap: 7 }, metricLabel: { fontSize: 13, fontWeight: "800" }, metricValue: { fontSize: 21, fontWeight: "800" }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: spacing.md, flexWrap: "wrap" }, section: { fontSize: 19, fontWeight: "800" }, row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 16, padding: spacing.lg }, rowCopy: { flex: 1, gap: spacing.sm }, rowName: { fontWeight: "800" }, track: { height: 8, borderRadius: 4, overflow: "hidden" }, fill: { height: "100%", borderRadius: 4 }, amount: { fontWeight: "800" }, empty: { gap: spacing.sm, borderWidth: 1, borderRadius: 16, padding: spacing.xl }, state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }, stateTitle: { fontSize: 18, fontWeight: "700" },
});
