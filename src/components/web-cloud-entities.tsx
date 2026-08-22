import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, RefreshCw, Search } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { formatAmount, formatShortDate } from "@/utils/format";
import { spacing, typography, useTheme } from "@/theme";

const TYPE_LABELS: Record<string, string> = {
  expense: "Dépense", income: "Revenu", transfer: "Transfert", accounts: "Compte", categories: "Catégorie",
  budget_plans: "Budget", goals: "Objectif", savings_rules: "Épargne automatique", recurring_transactions: "Transaction récurrente",
};

function value(entity: CloudEntity, key: string, fallback: string): string {
  const item = cloudFields(entity)[key];
  return item === null || item === undefined || item === "" ? fallback : String(item);
}

function amount(entity: CloudEntity): number {
  return Number(cloudFields(entity).amount ?? cloudFields(entity).target_amount ?? 0);
}

function transactionDate(entity: CloudEntity): number {
  const value = Number(cloudFields(entity).transaction_date ?? cloudFields(entity).created_at ?? 0);
  return value > 0 && value < 10_000_000_000 ? value * 1000 : value;
}

function dateLabel(timestamp: number): string {
  return timestamp ? formatShortDate(timestamp) : "Date inconnue";
}

export function WebCloudEntities({ title, eyebrow, entityTypes, emptyMessage }: {
  title: string;
  eyebrow: string;
  entityTypes: string[];
  emptyMessage: string;
}) {
  const theme = useTheme();
  const entityTypeKey = entityTypes.join(",");
  const normalizedTypes = useMemo(() => entityTypeKey ? entityTypeKey.split(",") : [], [entityTypeKey]);
  const isActivity = entityTypes.includes("transactions");
  const isPlanning = entityTypes.includes("budget_plans");
  const isAccounts = entityTypes.includes("accounts");
  const requestedEntityTypes = useMemo(
    () => Array.from(new Set(isActivity || isAccounts ? [...normalizedTypes, "accounts", "categories", "transactions"] : normalizedTypes)),
    [isActivity, isAccounts, normalizedTypes],
  );
  const entityTypeSet = useMemo(() => new Set(normalizedTypes), [normalizedTypes]);
  const [entities, setEntities] = useState<CloudEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "transfer">("all");

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

  // The first remote load intentionally synchronizes component state after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const related = useMemo(() => ({
    categories: entities.filter((entity) => entity.entityType === "categories"),
    accounts: entities.filter((entity) => entity.entityType === "accounts"),
  }), [entities]);

  const visibleEntities = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return entities
      .filter((entity) => entityTypeSet.has(entity.entityType))
      .filter((entity) => typeFilter === "all" || value(entity, "type", "") === typeFilter)
      .filter((entity) => {
        if (!query) return true;
        const item = cloudFields(entity);
        return [value(entity, "merchant", ""), value(entity, "note", ""), value(entity, "name", ""), TYPE_LABELS[value(entity, "type", "")] ?? "", String(item.tags ?? "")]
          .join(" ").toLocaleLowerCase("fr").includes(query);
      })
      .sort((a, b) => isActivity ? transactionDate(b) - transactionDate(a) : value(a, "name", "").localeCompare(value(b, "name", ""), "fr"));
  }, [entities, entityTypeSet, isActivity, search, typeFilter]);

  const groupedActivity = useMemo(() => {
    const groups = new Map<string, CloudEntity[]>();
    for (const entity of visibleEntities) {
      const label = dateLabel(transactionDate(entity));
      groups.set(label, [...(groups.get(label) ?? []), entity]);
    }
    return [...groups.entries()];
  }, [visibleEntities]);

  const groupedAccounts = useMemo(() => {
    const groups = new Map<string, CloudEntity[]>();
    for (const entity of visibleEntities) {
      const groupId = cloudRefs(entity).group_id ?? "none";
      const label = groupId === "none" ? "Sans groupe" : value(entity, "group_name", "Groupe de comptes");
      groups.set(label, [...(groups.get(label) ?? []), entity]);
    }
    return [...groups.entries()];
  }, [visibleEntities]);

  const renderEntity = (entity: CloudEntity) => {
    const item = cloudFields(entity);
    const refs = cloudRefs(entity);
    const category = related.categories.find((candidate) => candidate.entityId === refs.category_id);
    const account = related.accounts.find((candidate) => candidate.entityId === refs.account_id);
    const entityLabel = entity.entityType === "transactions" ? value(entity, "merchant", value(entity, "note", "Opération sans libellé")) : value(entity, "name", TYPE_LABELS[entity.entityType] ?? entity.entityType);
    const detail = entity.entityType === "transactions" ? `${TYPE_LABELS[String(item.type)] ?? "Opération"}${category ? ` · ${value(category, "name", "Catégorie")}` : ""}${account ? ` · ${value(account, "name", "Compte")}` : ""}` : TYPE_LABELS[entity.entityType] ?? entity.entityType;
    const content = (
      <>
        <View style={[styles.entityMarker, { backgroundColor: entity.entityType === "transactions" && value(entity, "type", "") === "expense" ? theme.expense : theme.accent }]} />
        <View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: theme.label }]} numberOfLines={1}>{entityLabel}</Text><Text style={[styles.rowMeta, { color: theme.secondaryLabel }]} numberOfLines={2}>{detail}</Text></View>
        <View style={styles.rowEnd}>{amount(entity) > 0 ? <Text style={[styles.amount, { color: theme.label }]}>{formatAmount(amount(entity), String(item.currency_code ?? "XOF"))}</Text> : null}{entity.entityType === "transactions" ? <ChevronRight size={18} color={theme.secondaryLabel} /> : null}</View>
      </>
    );
    if (entity.entityType === "transactions") return <Pressable key={`${entity.entityType}:${entity.entityId}`} accessibilityRole="link" accessibilityLabel={`Ouvrir ${entityLabel}`} onPress={() => router.push({ pathname: "/app/activity/[id]" as never, params: { id: entity.entityId } })} style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderColor: theme.separator }, pressed && styles.pressed]}>{content}</Pressable>;
    if (entity.entityType === "accounts") return <Pressable key={`${entity.entityType}:${entity.entityId}`} accessibilityRole="link" accessibilityLabel={`Ouvrir ${entityLabel}`} onPress={() => router.push({ pathname: "/app/accounts/[id]" as never, params: { id: entity.entityId } })} style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderColor: theme.separator }, pressed && styles.pressed]}>{content}<ChevronRight size={18} color={theme.secondaryLabel} /></Pressable>;
    return <View key={`${entity.entityType}:${entity.entityId}`} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.separator }]}>{content}</View>;
  };

  if (loading) return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={[styles.stateTitle, { color: theme.label }]}>Chargement de vos données cloud…</Text></View>;
  if (error) return <View style={[styles.state, { backgroundColor: theme.background }]}><InlineError message={error} onRetry={() => void load()} /><ActionButton label="Réessayer" onPress={() => void load()} /></View>;

  const hasNoData = entities.filter((entity) => entityTypeSet.has(entity.entityType)).length === 0;
  const accountEntities = entities.filter((entity) => entity.entityType === "accounts");
  const accountTransactions = entities.filter((entity) => entity.entityType === "transactions");
  const accountNet = accountTransactions.reduce((total, entity) => {
    const transactionType = value(entity, "type", "");
    const transactionAmount = amount(entity);
    return total + (transactionType === "income" ? transactionAmount : transactionType === "expense" ? -transactionAmount : 0);
  }, 0);
  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
      <View style={styles.heading}><View><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>{eyebrow}</Text><Text style={[styles.title, { color: theme.label }]}>{title}</Text></View><View style={styles.headingActions}>{isActivity ? <ActionButton label="Nouvelle opération" onPress={() => router.push("/new-transaction")} /> : null}<Pressable accessibilityRole="button" accessibilityLabel="Actualiser les données cloud" onPress={() => void load()} style={[styles.refresh, { borderColor: theme.separator }]}><RefreshCw size={17} color={theme.accent} /><Text style={[styles.refreshLabel, { color: theme.accent }]}>Actualiser</Text></Pressable></View></View>
      {isActivity ? <View style={styles.filters}><View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Search size={17} color={theme.secondaryLabel} /><TextInput value={search} onChangeText={setSearch} placeholder="Rechercher une transaction" placeholderTextColor={theme.secondaryLabel} accessibilityLabel="Rechercher une transaction" style={[styles.searchInput, { color: theme.label }]} /></View><View style={styles.filterChoices}>{(["all", "expense", "income", "transfer"] as const).map((filter) => <Pressable key={filter} onPress={() => setTypeFilter(filter)} accessibilityRole="radio" accessibilityState={{ selected: typeFilter === filter }} style={[styles.filterChoice, { backgroundColor: typeFilter === filter ? theme.accent : theme.surface, borderColor: typeFilter === filter ? theme.accent : theme.separator }]}><Text style={{ color: typeFilter === filter ? theme.onAccent : theme.label, fontWeight: "700" }}>{filter === "all" ? "Toutes" : TYPE_LABELS[filter]}</Text></Pressable>)}</View></View> : null}
      {hasNoData ? <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.emptyTitle, { color: theme.label }]}>Aucune donnée</Text><Text style={[styles.emptyText, { color: theme.secondaryLabel }]}>{emptyMessage}</Text>{isActivity ? <ActionButton label="Ajouter une opération" onPress={() => router.push("/new-transaction")} /> : null}</View> : null}
      {!hasNoData && isAccounts ? <View style={[styles.accountSummary, { backgroundColor: theme.accentSurface }]}><Text style={{ color: theme.accentSurfaceLabel, fontWeight: "800", letterSpacing: 0.7 }}>PATRIMOINE CLOUD</Text><View style={styles.summaryRow}><View><Text style={{ color: theme.accentSurfaceLabel, fontSize: 12 }}>Comptes</Text><Text style={[styles.summaryValue, { color: theme.accentSurfaceText }]}>{accountEntities.length}</Text></View><View><Text style={{ color: theme.accentSurfaceLabel, fontSize: 12 }}>Solde net calculé</Text><Text style={[styles.summaryValue, { color: accountNet >= 0 ? theme.accentSurfaceIncome : theme.accentSurfaceExpense }]}>{formatAmount(accountNet, "XOF")}</Text></View><View><Text style={{ color: theme.accentSurfaceLabel, fontSize: 12 }}>Transactions</Text><Text style={[styles.summaryValue, { color: theme.accentSurfaceText }]}>{accountTransactions.length}</Text></View></View><Text style={{ color: theme.accentSurfaceLabel, fontSize: 13 }}>Le solde cloud est dérivé des opérations synchronisées.</Text></View> : null}
      {!hasNoData && isActivity ? groupedActivity.map(([label, group]) => <View key={label} style={styles.section}><Text style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>{label}</Text>{group.map(renderEntity)}</View>) : null}
      {!hasNoData && isAccounts ? groupedAccounts.map(([label, group]) => <View key={label} style={styles.section}><Text style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>{label}</Text>{group.map(renderEntity)}</View>) : null}
      {!hasNoData && isPlanning ? normalizedTypes.map((entityType) => { const group = visibleEntities.filter((entity) => entity.entityType === entityType); return <View key={entityType} style={styles.section}><Text style={[styles.sectionTitle, { color: theme.label }]}>{TYPE_LABELS[entityType]}</Text>{group.length > 0 ? group.map(renderEntity) : <Text style={[styles.noItems, { color: theme.secondaryLabel }]}>Aucun élément pour le moment.</Text>}</View>; }) : null}
      {!hasNoData && !isActivity && !isAccounts && !isPlanning ? visibleEntities.map(renderEntity) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl }, heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }, headingActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { ...typography.display }, refresh: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }, refreshLabel: { fontSize: 13, fontWeight: "700" }, filters: { gap: spacing.md }, search: { maxWidth: 620, minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md }, searchInput: { flex: 1, minHeight: 44, fontSize: 15 }, filterChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, filterChoice: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 }, accountSummary: { gap: spacing.md, padding: spacing.xl, borderRadius: 22 }, summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl }, summaryValue: { fontSize: 22, fontWeight: "800", marginTop: 3 }, section: { gap: spacing.sm }, sectionTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" }, row: { minHeight: 66, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, padding: spacing.md, gap: spacing.md }, entityMarker: { width: 10, height: 10, borderRadius: 5 }, rowCopy: { flex: 1, gap: 4 }, rowTitle: { fontSize: 15, fontWeight: "700" }, rowMeta: { fontSize: 12 }, rowEnd: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, amount: { fontSize: 15, fontWeight: "800" }, empty: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 20, padding: spacing.xl }, emptyTitle: { fontSize: 18, fontWeight: "800" }, emptyText: { fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 600 }, noItems: { paddingVertical: spacing.md, fontSize: 14 }, state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }, stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" }, pressed: { opacity: 0.7 },
});
