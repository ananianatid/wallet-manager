import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { InlineError } from "@/components/ui";
import { formatAmount } from "@/utils/format";
import { spacing, typography, useTheme } from "@/theme";

export default function WebCloudStatistics() {
  const theme = useTheme();
  const [entities, setEntities] = useState<CloudEntity[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void loadCloudBootstrap(["transactions", "categories"]).then((result) => setEntities(result.entities.filter((entity) => entity.payload !== null))).catch((cause) => setError(cause instanceof Error ? cause.message : "Impossible de charger les statistiques.")); }, []);
  const transactions = useMemo(() => entities.filter((entity) => entity.entityType === "transactions"), [entities]);
  const categories = useMemo(() => entities.filter((entity) => entity.entityType === "categories"), [entities]);
  const total = (type: string) => transactions.filter((entity) => String(cloudFields(entity).type) === type).reduce((sum, entity) => sum + Number(cloudFields(entity).amount ?? 0), 0);
  const expenseByCategory = useMemo(() => {
    const values = new Map<string, number>();
    transactions.filter((entity) => cloudFields(entity).type === "expense").forEach((entity) => { const id = cloudRefs(entity).category_id ?? "none"; values.set(id, (values.get(id) ?? 0) + Number(cloudFields(entity).amount ?? 0)); });
    return [...values.entries()].sort((a, b) => b[1] - a[1]);
  }, [transactions]);
  if (error) return <View style={styles.state}><InlineError message={error} /></View>;
  return <View style={[styles.content, { backgroundColor: theme.background }]}><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>ESPACE CLOUD · ANALYSE</Text><Text style={[styles.title, { color: theme.label }]}>Statistiques</Text><View style={styles.metrics}><Metric label="Revenus" value={formatAmount(total("income"), "XOF")} color={theme.income} /><Metric label="Dépenses" value={formatAmount(total("expense"), "XOF")} color={theme.expense} /><Metric label="Transferts" value={formatAmount(total("transfer"), "XOF")} color={theme.accent} /></View><Text style={[styles.section, { color: theme.label }]}>Dépenses par catégorie</Text>{expenseByCategory.length === 0 ? <Text style={{ color: theme.secondaryLabel }}>Aucune dépense catégorisée pour le moment.</Text> : expenseByCategory.map(([id, amount]) => { const category = categories.find((item) => item.entityId === id); return <View key={id} style={[styles.row, { borderColor: theme.separator, backgroundColor: theme.surface }]}><Text style={[styles.rowName, { color: theme.label }]}>{category ? String(cloudFields(category).name ?? "Catégorie") : "Sans catégorie"}</Text><Text style={[styles.amount, { color: theme.label }]}>{formatAmount(amount, "XOF")}</Text></View>; })}</View>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) { const theme = useTheme(); return <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.metricLabel, { color }]}>{label}</Text><Text style={[styles.metricValue, { color: theme.label }]}>{value}</Text></View>; }
const styles = StyleSheet.create({ content: { flex: 1, padding: spacing.xl, gap: spacing.lg }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { ...typography.display }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, metric: { minWidth: 190, flexGrow: 1, padding: spacing.lg, borderWidth: 1, borderRadius: 14, gap: 7 }, metricLabel: { fontSize: 13, fontWeight: "800" }, metricValue: { fontSize: 23, fontWeight: "800" }, section: { fontSize: 18, fontWeight: "800", marginTop: spacing.md }, row: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderRadius: 12, padding: spacing.md }, rowName: { fontWeight: "700" }, amount: { fontWeight: "800" }, state: { flex: 1, alignItems: "center", justifyContent: "center" },
});
