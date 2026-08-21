import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { formatAmount } from "@/utils/format";
import { spacing, typography, useTheme } from "@/theme";

function fields(entity: CloudEntity): Record<string, unknown> {
  const payload = entity.payload as { fields?: Record<string, unknown> } | null;
  return payload?.fields ?? entity.payload ?? {};
}

function value(entity: CloudEntity, key: string, fallback: string): string {
  const item = fields(entity)[key];
  return item === null || item === undefined || item === "" ? fallback : String(item);
}

export function WebCloudEntities({
  title,
  eyebrow,
  entityTypes,
  emptyMessage,
}: {
  title: string;
  eyebrow: string;
  entityTypes: string[];
  emptyMessage: string;
}) {
  const theme = useTheme();
  const entityTypeKey = entityTypes.join(",");
  const requestedEntityTypes = useMemo(() => Array.from(new Set(entityTypes.includes("transactions") ? [...entityTypes, "accounts", "categories"] : entityTypes)), [entityTypeKey]);
  const [entities, setEntities] = useState<CloudEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCloudBootstrap(requestedEntityTypes);
      setEntities(result.entities.filter((entity) => entity.payload !== null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger les données cloud.");
    } finally {
      setLoading(false);
    }
  }, [requestedEntityTypes]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={[styles.stateTitle, { color: theme.label }]}>Chargement de vos données cloud…</Text></View>;
  if (error) return <View style={[styles.state, { backgroundColor: theme.background }]}><InlineError message={error} onRetry={() => void load()} /><ActionButton label="Réessayer" onPress={() => void load()} /></View>;

  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
      <View style={styles.heading}>
        <View><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>{eyebrow}</Text><Text style={[styles.title, { color: theme.label }]}>{title}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualiser les données cloud" onPress={() => void load()} style={[styles.refresh, { borderColor: theme.separator }]}><RefreshCw size={17} color={theme.accent} /><Text style={[styles.refreshLabel, { color: theme.accent }]}>Actualiser</Text></Pressable>
      </View>
      {entities.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.emptyTitle, { color: theme.label }]}>Aucune donnée</Text><Text style={[styles.emptyText, { color: theme.secondaryLabel }]}>{emptyMessage}</Text></View>
      ) : entities.filter((entity) => entityTypes.includes(entity.entityType)).map((entity) => {
        const item = cloudFields(entity);
        const refs = cloudRefs(entity);
        const amount = Number(item.amount ?? 0);
        const typeLabels: Record<string, string> = { expense: "Dépense", income: "Revenu", transfer: "Transfert", accounts: "Compte", categories: "Catégorie" };
        const label = entity.entityType === "transactions" ? value(entity, "merchant", value(entity, "note", "Opération sans libellé")) : value(entity, "name", typeLabels[entity.entityType] ?? entity.entityType);
        const category = entities.find((candidate) => candidate.entityType === "categories" && candidate.entityId === refs.category_id);
        const account = entities.find((candidate) => candidate.entityType === "accounts" && candidate.entityId === refs.account_id);
        const detail = entity.entityType === "transactions" ? `${typeLabels[String(item.type)] ?? "Opération"}${category ? ` · ${value(category, "name", "Catégorie")}` : ""}${account ? ` · ${value(account, "name", "Compte")}` : ""}` : typeLabels[entity.entityType] ?? entity.entityType;
        return <View key={`${entity.entityType}:${entity.entityId}`} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.separator }]}><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: theme.label }]}>{label}</Text><Text style={[styles.rowMeta, { color: theme.secondaryLabel }]}>{detail}</Text></View>{amount > 0 ? <Text style={[styles.amount, { color: theme.label }]}>{formatAmount(amount, String(item.currency_code ?? "XOF"))}</Text> : null}</View>;
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { ...typography.display },
  refresh: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  refreshLabel: { fontSize: 13, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, padding: spacing.lg, gap: spacing.md },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowMeta: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: "800" },
  empty: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 20, padding: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 600 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
}) as any;
