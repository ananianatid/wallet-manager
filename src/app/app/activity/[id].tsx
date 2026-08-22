import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { WebAppShell } from "@/components/web-app-shell";
import { formatAmount, formatDate } from "@/utils/format";
import { spacing, typography, useTheme } from "@/theme";

const labels: Record<string, string> = { expense: "Dépense", income: "Revenu", transfer: "Transfert" };

function fields(entity: CloudEntity): Record<string, unknown> {
  return cloudFields(entity);
}

function dateValue(entity: CloudEntity): number {
  const value = Number(fields(entity).transaction_date ?? 0);
  return value > 0 && value < 10_000_000_000 ? value * 1000 : value;
}

export default function CloudTransactionDetail() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [transaction, setTransaction] = useState<CloudEntity | null>(null);
  const [related, setRelated] = useState<CloudEntity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCloudBootstrap(["transactions", "accounts", "categories"])
      .then((result) => {
        setTransaction(result.entities.find((entity) => entity.entityType === "transactions" && entity.entityId === id && entity.payload !== null) ?? null);
        setRelated(result.entities.filter((entity) => entity.payload !== null));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Impossible de charger la transaction."));
  }, [id]);

  const category = useMemo(() => transaction ? related.find((entity) => entity.entityType === "categories" && entity.entityId === cloudRefs(transaction).category_id) : null, [related, transaction]);
  const account = useMemo(() => transaction ? related.find((entity) => entity.entityType === "accounts" && entity.entityId === cloudRefs(transaction).account_id) : null, [related, transaction]);
  const destination = useMemo(() => transaction ? related.find((entity) => entity.entityType === "accounts" && entity.entityId === cloudRefs(transaction).destination_account_id) : null, [related, transaction]);

  return <WebAppShell><ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Retour à l’activité" onPress={() => router.back()} style={styles.back}><ArrowLeft size={18} color={theme.accent} /><Text style={{ color: theme.accent, fontWeight: "700" }}>Retour à l’activité</Text></Pressable>
    {error ? <InlineError message={error} onRetry={() => router.replace("/app/activity")} /> : null}
    {!error && !transaction ? <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.title, { color: theme.label }]}>Transaction introuvable</Text><Text style={{ color: theme.secondaryLabel }}>Cette opération n’est plus disponible dans votre espace cloud.</Text><ActionButton label="Retour à l’activité" onPress={() => router.replace("/app/activity")} /></View> : null}
    {transaction ? <>
      <View style={styles.heading}><View><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>ACTIVITÉ · DÉTAIL</Text><Text style={[styles.title, { color: theme.label }]}>{String(fields(transaction).merchant ?? fields(transaction).note ?? "Opération sans libellé")}</Text><Text style={{ color: theme.secondaryLabel }}>{labels[String(fields(transaction).type)] ?? "Opération"} · {dateValue(transaction) ? formatDate(dateValue(transaction)) : "Date inconnue"}</Text></View><View style={styles.actions}><ActionButton label="Modifier" onPress={() => router.push({ pathname: "/new-transaction" as never, params: { id: transaction.entityId } })} accessibilityLabel="Modifier la transaction" /><ActionButton label="Nouvelle opération" variant="secondary" onPress={() => router.push("/new-transaction")} accessibilityLabel="Créer une nouvelle opération" /></View></View>
      <View style={[styles.amountCard, { backgroundColor: theme.accentSurface }]}><Text style={{ color: theme.accentSurfaceLabel, fontWeight: "700" }}>Montant</Text><Text style={[styles.amount, { color: theme.accentSurfaceText }]}>{formatAmount(Number(fields(transaction).amount ?? 0), String(fields(transaction).currency_code ?? "XOF"))}</Text></View>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
        <Detail label="Compte" value={account ? String(fields(account).name ?? "Compte") : "Compte introuvable"} />
        {destination ? <Detail label="Destination" value={String(fields(destination).name ?? "Compte") } /> : null}
        {category ? <Detail label="Catégorie" value={String(fields(category).name ?? "Catégorie")} /> : null}
        {fields(transaction).merchant ? <Detail label="Marchand" value={String(fields(transaction).merchant)} /> : null}
        {fields(transaction).note ? <Detail label="Note" value={String(fields(transaction).note)} /> : null}
        {fields(transaction).tags ? <Detail label="Tags" value={Array.isArray(fields(transaction).tags) ? (fields(transaction).tags as unknown[]).join(", ") : String(fields(transaction).tags)} /> : null}
      </View>
    </> : null}
  </ScrollView></WebAppShell>;
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return <View style={styles.detail}><Text style={[styles.detailLabel, { color: theme.secondaryLabel }]}>{label}</Text><Text style={[styles.detailValue, { color: theme.label }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl }, back: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start" }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.lg, flexWrap: "wrap" }, actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { ...typography.display }, amountCard: { maxWidth: 680, borderRadius: 22, padding: spacing.xl, gap: spacing.sm }, amount: { fontSize: 42, fontWeight: "800" }, card: { maxWidth: 680, borderWidth: 1, borderRadius: 18, padding: spacing.xl, gap: spacing.lg }, detail: { gap: 4 }, detailLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }, detailValue: { fontSize: 16, lineHeight: 22 }, empty: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 18, padding: spacing.xl },
});
