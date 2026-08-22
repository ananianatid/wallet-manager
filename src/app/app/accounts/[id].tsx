import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight, RefreshCw, WalletCards } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { WebAppShell } from "@/components/web-app-shell";
import { formatAmount, formatShortDate } from "@/utils/format";
import { spacing, typography, useTheme } from "@/theme";

function field(entity: CloudEntity, key: string, fallback: string): string {
  const value = cloudFields(entity)[key];
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function timestamp(entity: CloudEntity): number {
  const value = Number(cloudFields(entity).transaction_date ?? cloudFields(entity).created_at ?? 0);
  return value > 0 && value < 10_000_000_000 ? value * 1000 : value;
}

function transactionLabel(entity: CloudEntity): string {
  return field(entity, "merchant", field(entity, "note", "Opération sans libellé"));
}

export default function WebAccountDetail() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [entities, setEntities] = useState<CloudEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCloudBootstrap(["accounts", "transactions", "categories"]);
      setEntities(result.entities.filter((entity) => entity.payload !== null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger ce compte cloud.");
    } finally {
      setLoading(false);
    }
  }, []);

  // The first remote load intentionally synchronizes component state after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const account = entities.find((entity) => entity.entityType === "accounts" && entity.entityId === id) ?? null;
  const categories = useMemo(() => entities.filter((entity) => entity.entityType === "categories"), [entities]);
  const transactions = useMemo(() => entities.filter((entity) => entity.entityType === "transactions" && cloudRefs(entity).account_id === id).sort((a, b) => timestamp(b) - timestamp(a)), [entities, id]);
  const balance = transactions.reduce((total, entity) => {
    const amount = Number(cloudFields(entity).amount ?? 0);
    const type = field(entity, "type", "");
    return total + (type === "income" ? amount : type === "expense" ? -amount : 0);
  }, 0);

  if (loading) return <WebAppShell><View style={[styles.state, { backgroundColor: theme.background }]}><Text style={{ color: theme.label }}>Chargement du compte…</Text></View></WebAppShell>;
  if (error) return <WebAppShell><View style={[styles.state, { backgroundColor: theme.background }]}><InlineError message={error} onRetry={() => void load()} /><ActionButton label="Réessayer" onPress={() => void load()} /></View></WebAppShell>;
  if (!account) return <WebAppShell><View style={[styles.state, { backgroundColor: theme.background }]}><Text style={[styles.stateTitle, { color: theme.label }]}>Compte introuvable</Text><ActionButton label="Retour aux comptes" onPress={() => router.replace("/app/accounts")} /></View></WebAppShell>;

  return <WebAppShell><ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}><Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour aux comptes"><Text style={{ color: theme.accent, fontWeight: "800" }}>← Retour aux comptes</Text></Pressable><View style={styles.heading}><View><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>COMPTE FINANCIER</Text><Text style={[styles.title, { color: theme.label }]}>{field(account, "name", "Compte sans nom")}</Text></View><WalletCards size={30} color={theme.accent} /></View><View style={[styles.summary, { backgroundColor: theme.accentSurface }]}><Text style={{ color: theme.accentSurfaceLabel, fontWeight: "800" }}>SOLDE CALCULÉ</Text><Text style={[styles.balance, { color: balance >= 0 ? theme.accentSurfaceIncome : theme.accentSurfaceExpense }]}>{formatAmount(balance, field(account, "currency_code", "XOF"))}</Text><Text style={{ color: theme.accentSurfaceLabel }}>Dérivé des opérations cloud liées à ce compte.</Text></View><View style={styles.actions}><ActionButton label="Nouvelle opération" onPress={() => router.push("/new-transaction")} /><Pressable accessibilityRole="button" accessibilityLabel="Actualiser le compte" onPress={() => void load()} style={[styles.refresh, { borderColor: theme.separator }]}><RefreshCw size={17} color={theme.accent} /><Text style={{ color: theme.accent, fontWeight: "700" }}>Actualiser</Text></Pressable></View><View style={styles.section}><Text style={[styles.sectionTitle, { color: theme.label }]}>Opérations liées ({transactions.length})</Text>{transactions.length === 0 ? <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.emptyTitle, { color: theme.label }]}>Aucune opération</Text><Text style={{ color: theme.secondaryLabel }}>Ajoutez une opération pour commencer à suivre ce compte.</Text></View> : transactions.map((transaction) => { const categoryId = cloudRefs(transaction).category_id; const category = categories.find((item) => item.entityId === categoryId); return <Pressable key={transaction.entityId} accessibilityRole="link" accessibilityLabel={`Ouvrir ${transactionLabel(transaction)}`} onPress={() => router.push({ pathname: "/app/activity/[id]" as never, params: { id: transaction.entityId } })} style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderColor: theme.separator }, pressed && styles.pressed]}><View style={[styles.dot, { backgroundColor: field(transaction, "type", "") === "expense" ? theme.expense : theme.income }]} /><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: theme.label }]}>{transactionLabel(transaction)}</Text><Text style={[styles.rowMeta, { color: theme.secondaryLabel }]}>{timestamp(transaction) ? formatShortDate(timestamp(transaction)) : "Date inconnue"}{category ? ` · ${field(category, "name", "Catégorie")}` : ""}</Text></View><Text style={[styles.amount, { color: theme.label }]}>{formatAmount(Number(cloudFields(transaction).amount ?? 0), field(account, "currency_code", "XOF"))}</Text><ChevronRight size={18} color={theme.secondaryLabel} /></Pressable>; })}</View></ScrollView></WebAppShell>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { ...typography.display },
  summary: { gap: spacing.sm, padding: spacing.xl, borderRadius: 22 },
  balance: { fontSize: 30, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  refresh: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16 },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 16, padding: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowMeta: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: "800" },
  empty: { gap: spacing.sm, borderWidth: 1, borderRadius: 20, padding: spacing.xl },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  state: { flex: 1, minHeight: 420, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  stateTitle: { fontSize: 20, fontWeight: "800" },
  pressed: { opacity: 0.7 },
});
