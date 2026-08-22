import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { loadCloudBootstrap, upsertCloudEntity, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { spacing, typography, useTheme } from "@/theme";

type PlanningType = "budget_plans" | "goals" | "savings_rules" | "recurring_transactions";
type ChoiceOption = { entityId: string; label: string };
const TITLES: Record<PlanningType, string> = { budget_plans: "Budget", goals: "Objectif", savings_rules: "Règle d’épargne", recurring_transactions: "Transaction récurrente" };
const TYPES: PlanningType[] = ["budget_plans", "goals", "savings_rules", "recurring_transactions"];

function parseAmount(value: string): number | null { const parsed = Number(value.replace(/\s/g, "").replace(",", ".")); return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null; }
function text(entity: CloudEntity | null, key: string, fallback = ""): string { const value = entity ? cloudFields(entity)[key] : null; return value == null ? fallback : String(value); }
function dateInput(value: number): string { return value > 0 ? new Date(value > 10_000_000_000 ? value : value * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10); }

export default function WebCloudPlanningForm() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const type = (TYPES.includes(params.type as PlanningType) ? params.type : "goals") as PlanningType;
  const editingId = params.id ?? null;
  const [existing, setExisting] = useState<CloudEntity | null>(null);
  const [categories, setCategories] = useState<CloudEntity[]>([]);
  const [accounts, setAccounts] = useState<CloudEntity[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [percent, setPercent] = useState("");
  const [targetDate, setTargetDate] = useState(dateInput(0));
  const [frequency, setFrequency] = useState("monthly");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [typeValue, setTypeValue] = useState("expense");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCloudBootstrap(["categories", "accounts", type]).then((result) => {
      const live = result.entities.filter((entity) => entity.payload !== null);
      setCategories(live.filter((entity) => entity.entityType === "categories"));
      setAccounts(live.filter((entity) => entity.entityType === "accounts"));
      const next = editingId ? live.find((entity) => entity.entityType === type && entity.entityId === editingId) ?? null : null;
      if (next) {
        const item = cloudFields(next);
        setExisting(next); setName(text(next, "name")); setAmount(item.amount != null ? String(Number(item.amount) / 100) : item.target_amount != null ? String(Number(item.target_amount) / 100) : ""); setPercent(item.percent != null ? String(item.percent) : ""); setTargetDate(dateInput(Number(item.target_date ?? 0))); setFrequency(text(next, "frequency", "monthly")); setAccountId(cloudRefs(next).account_id ?? ""); setCategoryId(cloudRefs(next).category_id ?? ""); setTypeValue(text(next, "type", "expense"));
      }
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Impossible de charger le formulaire cloud.")).finally(() => setLoading(false));
  }, [editingId, type]);

  const categoryOptions = useMemo<ChoiceOption[]>(() => categories.filter((item) => type === "savings_rules" ? text(item, "type") === "income" : text(item, "type") === "expense").map((item) => ({ entityId: item.entityId, label: text(item, "name", "Catégorie") })), [categories, type]);
  const accountOptions = useMemo<ChoiceOption[]>(() => accounts.map((item) => ({ entityId: item.entityId, label: text(item, "name", "Compte") })), [accounts]);
  const save = async () => {
    setError(null);
    const parsedAmount = parseAmount(amount);
    const parsedPercent = Number(percent.replace(",", "."));
    if (type === "goals" && (!name.trim() || !parsedAmount || !targetDate)) return setError("Saisissez un nom, un montant cible et une date.");
    if ((type === "budget_plans" || type === "recurring_transactions") && !parsedAmount) return setError("Saisissez un montant positif.");
    if (type === "savings_rules" && (!Number.isFinite(parsedPercent) || parsedPercent <= 0 || parsedPercent > 100)) return setError("Le pourcentage doit être compris entre 1 et 100.");
    if (type === "recurring_transactions" && !accountId) return setError("Choisissez un compte.");
    setSaving(true);
    try {
      const now = Date.now();
      let payload: { fields: Record<string, unknown>; refs: Record<string, string | null> };
      if (type === "budget_plans") payload = { fields: { amount: parsedAmount, currency_code: "XOF", rollover_enabled: 0, is_active: 1, created_at: now }, refs: { category_id: categoryId || null } };
      else if (type === "goals") payload = { fields: { name: name.trim(), target_amount: parsedAmount, currency_code: "XOF", target_date: new Date(`${targetDate}T12:00:00`).getTime(), status: "active", reserved_amount: 0, created_at: now }, refs: {} };
      else if (type === "savings_rules") payload = { fields: { percent: parsedPercent, subtract_from_available: 0, created_at: now, start_date: null }, refs: { category_id: categoryId || null } };
      else payload = { fields: { type: typeValue, amount: parsedAmount, currency_code: "XOF", frequency, interval: 1, next_date: new Date(`${targetDate}T12:00:00`).getTime(), is_active: 1, created_at: now }, refs: { account_id: accountId || null, category_id: categoryId || null, destination_account_id: null } };
      await upsertCloudEntity({ entityType: type, entityId: existing?.entityId ?? randomUUID(), baseVersion: existing?.version ?? 0, payload });
      router.replace("/app/planning");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer cet élément."); } finally { setSaving(false); }
  };

  if (loading) return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={{ color: theme.label }}>Préparation du formulaire…</Text></View>;
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}><Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour à la planification"><Text style={{ color: theme.accent, fontWeight: "800" }}>← Retour à la planification</Text></Pressable><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>PLANIFICATION · {editingId ? "MODIFIER" : "NOUVEAU"}</Text><Text style={[styles.title, { color: theme.label }]}>{editingId ? `Modifier ${TITLES[type].toLocaleLowerCase("fr")}` : `Créer ${type === "goals" ? "un objectif" : type === "budget_plans" ? "un budget" : type === "savings_rules" ? "une règle d’épargne" : "une récurrence"}`}</Text>{error ? <InlineError message={error} /> : null}<View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>{type === "goals" ? <><Field label="Nom" value={name} onChangeText={setName} placeholder="Ex. Fonds de sécurité" theme={theme} /><Field label="Montant cible (XOF)" value={amount} onChangeText={setAmount} placeholder="0" theme={theme} inputMode="decimal" /><Field label="Date cible" value={targetDate} onChangeText={setTargetDate} placeholder="AAAA-MM-JJ" theme={theme} /></> : null}{type === "budget_plans" ? <><Field label="Montant du plafond (XOF)" value={amount} onChangeText={setAmount} placeholder="0" theme={theme} inputMode="decimal" /><ChoiceField label="Catégorie" value={categoryId} options={categoryOptions} onChange={setCategoryId} theme={theme} /></> : null}{type === "savings_rules" ? <><Field label="Pourcentage des revenus" value={percent} onChangeText={setPercent} placeholder="10" theme={theme} inputMode="decimal" /><ChoiceField label="Catégorie de revenus" value={categoryId} options={categoryOptions} onChange={setCategoryId} theme={theme} /></> : null}{type === "recurring_transactions" ? <><ChoiceField label="Type" value={typeValue} options={[{ entityId: "expense", label: "Dépense" }, { entityId: "income", label: "Revenu" }, { entityId: "transfer", label: "Transfert" }]} onChange={setTypeValue} theme={theme} /><Field label="Montant (XOF)" value={amount} onChangeText={setAmount} placeholder="0" theme={theme} inputMode="decimal" /><ChoiceField label="Compte" value={accountId} options={accountOptions} onChange={setAccountId} theme={theme} /><ChoiceField label="Catégorie" value={categoryId} options={categoryOptions} onChange={setCategoryId} theme={theme} /><ChoiceField label="Fréquence" value={frequency} options={["daily", "weekly", "monthly", "yearly"].map((value) => ({ entityId: value, label: frequencyLabel(value) }))} onChange={setFrequency} theme={theme} /><Field label="Prochaine échéance" value={targetDate} onChangeText={setTargetDate} placeholder="AAAA-MM-JJ" theme={theme} /></> : null}<ActionButton label={saving ? "Enregistrement…" : "Enregistrer"} onPress={() => void save()} disabled={saving} /></View></ScrollView>;
}

function Field({ label, value, onChangeText, placeholder, theme, inputMode }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; theme: ReturnType<typeof useTheme>; inputMode?: "decimal" | "numeric" }) { return <View style={styles.field}><Text style={[styles.label, { color: theme.label }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.secondaryLabel} inputMode={inputMode} style={[styles.input, { color: theme.label, borderColor: theme.separator, backgroundColor: theme.background }]} /></View>; }
function ChoiceField({ label, value, options, onChange, theme }: { label: string; value: string; options: ChoiceOption[]; onChange: (value: string) => void; theme: ReturnType<typeof useTheme> }) { return <View style={styles.field}><Text style={[styles.label, { color: theme.label }]}>{label}</Text><View style={styles.choices}>{options.length === 0 ? <Text style={{ color: theme.secondaryLabel }}>Aucune option disponible.</Text> : options.map((option) => <Pressable key={option.entityId} onPress={() => onChange(option.entityId)} accessibilityRole="radio" accessibilityState={{ selected: value === option.entityId }} style={[styles.choice, { backgroundColor: value === option.entityId ? theme.accent : theme.background, borderColor: value === option.entityId ? theme.accent : theme.separator }]}><Text style={{ color: value === option.entityId ? theme.onAccent : theme.label, fontWeight: "700" }}>{option.label}</Text></Pressable>)}</View></View>; }
function frequencyLabel(value: string): string { return value === "daily" ? "Tous les jours" : value === "weekly" ? "Toutes les semaines" : value === "yearly" ? "Tous les ans" : "Tous les mois"; }

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: spacing.xl, gap: spacing.lg }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { ...typography.display }, card: { maxWidth: 720, gap: spacing.lg, borderWidth: 1, borderRadius: 20, padding: spacing.xl }, field: { gap: spacing.sm }, label: { fontSize: 13, fontWeight: "800" }, input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, fontSize: 15 }, choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, choice: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md }, state: { flex: 1, alignItems: "center", justifyContent: "center" },
});
