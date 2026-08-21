import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, WalletCards } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { formatAmount } from "@/utils/format";
import { spacing, typography, useTheme } from "@/theme";

type CloudPayload = {
  fields?: Record<string, unknown>;
  refs?: Record<string, string | null>;
};

function fields(entity: CloudEntity): Record<string, unknown> {
  const payload = entity.payload as CloudPayload | null;
  return payload?.fields ?? entity.payload ?? {};
}

function stringField(entity: CloudEntity, key: string, fallback: string): string {
  const value = fields(entity)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberField(entity: CloudEntity, key: string): number {
  const value = fields(entity)[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}

function entityDate(entity: CloudEntity): number {
  const value = fields(entity).transaction_date ?? fields(entity).created_at;
  const number = Number(value ?? 0);
  return number > 0 && number < 10_000_000_000 ? number * 1000 : number;
}

export default function WebCloudDashboard() {
  const theme = useTheme();
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
      setError(cause instanceof Error ? cause.message : "Impossible de charger vos données cloud.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accounts = useMemo(() => entities.filter((entity) => entity.entityType === "accounts"), [entities]);
  const transactions = useMemo(
    () => entities.filter((entity) => entity.entityType === "transactions").sort((a, b) => entityDate(b) - entityDate(a)),
    [entities],
  );
  const categories = useMemo(() => entities.filter((entity) => entity.entityType === "categories"), [entities]);
  const expenses = transactions.filter((transaction) => stringField(transaction, "type", "") === "expense");
  const expenseTotal = expenses.reduce((total, transaction) => total + numberField(transaction, "amount"), 0);

  if (loading) {
    return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={[styles.stateTitle, { color: theme.label }]}>Chargement de vos données cloud…</Text></View>;
  }

  if (error) {
    return (
      <View style={[styles.state, { backgroundColor: theme.background }]}>
        <InlineError message={error} onRetry={() => void load()} />
        <ActionButton label="Réessayer" onPress={() => void load()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
      <View style={styles.heading}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>ESPACE CLOUD</Text>
          <Text style={[styles.title, { color: theme.label }]}>Vos données</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualiser les données cloud" onPress={() => void load()} style={[styles.refresh, { borderColor: theme.separator }]}>
          <RefreshCw size={17} color={theme.accent} />
          <Text style={[styles.refreshLabel, { color: theme.accent }]}>Actualiser</Text>
        </Pressable>
      </View>

      <View style={styles.metrics}>
        <Metric label="Comptes financiers" value={String(accounts.length)} />
        <Metric label="Transactions" value={String(transactions.length)} />
        <Metric label="Dépenses enregistrées" value={formatAmount(expenseTotal, "XOF")} />
      </View>

      {accounts.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          <WalletCards size={26} color={theme.accent} />
          <Text style={[styles.emptyTitle, { color: theme.label }]}>Aucun compte financier</Text>
          <Text style={[styles.emptyText, { color: theme.secondaryLabel }]}>Vos données cloud sont bien accessibles. Ajoutez maintenant un compte bancaire, une caisse ou un portefeuille mobile.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={[styles.sectionTitle, { color: theme.label }]}>Comptes financiers</Text>
          {accounts.map((account) => (
            <View key={account.entityId} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <WalletCards size={20} color={theme.accent} />
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.label }]}>{stringField(account, "name", "Compte sans nom")}</Text>
                <Text style={[styles.rowMeta, { color: theme.secondaryLabel }]}>{stringField(account, "currency_code", "XOF")}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {transactions.length > 0 ? (
        <View style={styles.list}>
          <Text style={[styles.sectionTitle, { color: theme.label }]}>Dernières transactions</Text>
          {transactions.slice(0, 8).map((transaction) => (
            <View key={transaction.entityId} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <View style={[styles.transactionDot, { backgroundColor: stringField(transaction, "type", "") === "expense" ? theme.expense : theme.income }]} />
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.label }]}>{stringField(transaction, "merchant", stringField(transaction, "note", "Transaction"))}</Text>
                <Text style={[styles.rowMeta, { color: theme.secondaryLabel }]}>{transactionTypeLabel(stringField(transaction, "type", "operation"))}{categoryFor(transaction, categories) ? ` · ${stringField(categoryFor(transaction, categories)!, "name", "Catégorie")}` : ""}</Text>
              </View>
              <Text style={[styles.amount, { color: theme.label }]}>{formatAmount(numberField(transaction, "amount"), "XOF")}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function transactionTypeLabel(type: string): string {
  return ({ expense: "Dépense", income: "Revenu", transfer: "Transfert" } as Record<string, string>)[type] ?? "Opération";
}

function categoryFor(transaction: CloudEntity, categories: CloudEntity[]): CloudEntity | null {
  const categoryId = cloudRefs(transaction).category_id;
  return categories.find((category) => category.entityId === categoryId) ?? null;
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.metricLabel, { color: theme.secondaryLabel }]}>{label}</Text><Text style={[styles.metricValue, { color: theme.label }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { ...typography.display },
  refresh: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  refreshLabel: { fontSize: 13, fontWeight: "700" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metric: { flexGrow: 1, minWidth: 180, borderWidth: 1, borderRadius: 16, padding: spacing.lg, gap: 8 },
  metricLabel: { fontSize: 13, fontWeight: "600" },
  metricValue: { fontSize: 24, fontWeight: "800" },
  list: { gap: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 16, padding: spacing.md },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowMeta: { fontSize: 12, textTransform: "capitalize" },
  amount: { fontSize: 15, fontWeight: "800" },
  transactionDot: { width: 10, height: 10, borderRadius: 5 },
  empty: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 20, padding: spacing.xl, maxWidth: 620 },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
}) as any;
