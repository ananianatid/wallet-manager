import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { loadCloudBootstrap, upsertCloudEntity, type CloudEntity } from "@/cloud/api";
import { cloudFields, toCloudCategory, transactionPayload, type CloudCategory } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { spacing, typography, useTheme } from "@/theme";
import type { TransactionType } from "@/types";

function accountName(entity: CloudEntity): string { return String(cloudFields(entity).name ?? "Compte"); }
function currency(entity: CloudEntity): string { return String(cloudFields(entity).currency_code ?? "XOF").toUpperCase(); }
function parseAmount(value: string): number | null {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

const TYPES: { value: TransactionType; label: string; help: string }[] = [
  { value: "expense", label: "Dépense", help: "Une sortie d’argent" },
  { value: "income", label: "Revenu", help: "Une entrée d’argent" },
  { value: "transfer", label: "Transfert", help: "Entre deux comptes" },
];

export default function WebCloudTransaction() {
  const theme = useTheme();
  const [accounts, setAccounts] = useState<CloudEntity[]>([]);
  const [categories, setCategories] = useState<CloudCategory[]>([]);
  const [type, setType] = useState<TransactionType>("expense");
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState("");
  const [fee, setFee] = useState("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitRows, setSplitRows] = useState<{ categoryId: string; amount: string }[]>([
    { categoryId: "", amount: "" },
    { categoryId: "", amount: "" },
  ]);
  const [reimbursementEnabled, setReimbursementEnabled] = useState(false);
  const [reimbursementPerson, setReimbursementPerson] = useState("");
  const [reimbursementAmount, setReimbursementAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCloudBootstrap(["accounts", "categories"]).then((result) => {
      const live = result.entities.filter((entity) => entity.payload !== null);
      const nextAccounts = live.filter((entity) => entity.entityType === "accounts");
      setAccounts(nextAccounts);
      setCategories(live.filter((entity) => entity.entityType === "categories").map(toCloudCategory));
      if (nextAccounts[0]) setAccountId(nextAccounts[0].entityId);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Impossible de charger les comptes et catégories.")).finally(() => setLoading(false));
  }, []);

  const source = useMemo(() => accounts.find((item) => item.entityId === accountId) ?? null, [accounts, accountId]);
  const destination = useMemo(() => accounts.find((item) => item.entityId === destinationAccountId) ?? null, [accounts, destinationAccountId]);
  const availableCategories = useMemo(() => categories.filter((item) => item.type === type), [categories, type]);
  const crossCurrency = Boolean(destination && source && currency(destination) !== currency(source));

  const selectType = (next: TransactionType) => { setType(next); setCategoryId(""); setDestinationAccountId(""); setDestinationAmount(""); setFee(""); setError(null); };

  const save = async () => {
    const parsedAmount = parseAmount(amount);
    const parsedDestinationAmount = destinationAmount.trim() ? parseAmount(destinationAmount) : parsedAmount;
    const parsedFee = fee.trim() ? parseAmount(fee) : null;
    if (!source) return setError("Choisissez le compte concerné.");
    if (!parsedAmount) return setError(`Saisissez un montant valide en ${currency(source)}.`);
    if (type !== "transfer" && !categoryId) return setError("Choisissez une catégorie.");
    const tags = tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean);
    const allocations = splitEnabled
      ? splitRows.map((row) => ({ categoryId: row.categoryId, amount: parseAmount(row.amount) }))
          .filter((row): row is { categoryId: string; amount: number } => Boolean(row.categoryId && row.amount))
      : [];
    if (splitEnabled && (allocations.length < 2 || allocations.reduce((sum, row) => sum + row.amount, 0) !== parsedAmount)) {
      return setError("La somme des répartitions doit être égale au montant.");
    }
    const reimbursementAmountMinor = reimbursementEnabled ? parseAmount(reimbursementAmount) : null;
    if (reimbursementEnabled && (!reimbursementPerson.trim() || !reimbursementAmountMinor)) {
      return setError("Saisissez la personne et le montant du remboursement.");
    }
    if (type === "transfer" && (!destination || destination.entityId === source.entityId)) return setError("Choisissez un compte de destination différent.");
    if (type === "transfer" && !parsedDestinationAmount) return setError(`Saisissez le montant crédité en ${destination ? currency(destination) : "devise cible"}.`);
    setSaving(true); setError(null);
    try {
      const sourceAmount = parsedAmount / 100;
      const targetAmount = parsedDestinationAmount ? parsedDestinationAmount / 100 : null;
      await upsertCloudEntity({
        entityType: "transactions", entityId: randomUUID(), baseVersion: 0,
        payload: transactionPayload({
          type, amount: parsedAmount, accountId: source.entityId,
          destinationAccountId: type === "transfer" ? destination!.entityId : null,
          categoryId: type === "transfer" ? null : categoryId,
          destinationAmount: type === "transfer" ? parsedDestinationAmount : null,
          exchangeRate: type === "transfer" && targetAmount ? targetAmount / sourceAmount : null,
          exchangeRateDate: type === "transfer" ? new Date(date).toISOString().slice(0, 10) : null,
          exchangeRateProvider: crossCurrency ? "manual" : type === "transfer" ? "same currency" : null,
          fee: type === "transfer" ? parsedFee : null, merchant: merchant.trim() || null,
          note: note.trim() || null,
          transactionDate: new Date(date).getTime(),
          tags,
          allocations,
          reimbursements: reimbursementEnabled ? [{ personName: reimbursementPerson.trim(), direction: "owed_to_me", amount: reimbursementAmountMinor! }] : [],
        }) as Record<string, unknown>,
      });
      router.replace("/app/activity");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer l’opération cloud."); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={{ color: theme.label }}>Chargement des comptes et catégories…</Text></View>;
  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
      <Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>ESPACE CLOUD · OPÉRATION</Text>
      <Text style={[styles.title, { color: theme.label }]}>Nouvelle opération</Text>
      <Text style={[styles.lead, { color: theme.secondaryLabel }]}>Enregistrez une dépense, un revenu ou un transfert dans votre espace synchronisé.</Text>
      {error ? <InlineError message={error} /> : null}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
        <Text style={[styles.label, { color: theme.label }]}>Type d’opération</Text>
        <View style={styles.typeGrid}>{TYPES.map((item) => <Pressable key={item.value} onPress={() => selectType(item.value)} accessibilityRole="radio" accessibilityState={{ selected: type === item.value }} style={[styles.typeChoice, { backgroundColor: type === item.value ? theme.accent : theme.surface, borderColor: type === item.value ? theme.accent : theme.separator }]}><Text style={[styles.typeLabel, { color: type === item.value ? theme.onAccent : theme.label }]}>{item.label}</Text><Text style={{ color: type === item.value ? theme.onAccent : theme.secondaryLabel, fontSize: 12 }}>{item.help}</Text></Pressable>)}</View>
        <FieldLabel label="Compte" color={theme.label} /><View style={styles.choiceGrid}>{accounts.map((item) => <Choice key={item.entityId} active={accountId === item.entityId} label={`${accountName(item)} · ${currency(item)}`} onPress={() => setAccountId(item.entityId)} theme={theme} />)}</View>
        {type === "transfer" ? <><FieldLabel label="Compte de destination" color={theme.label} /><View style={styles.choiceGrid}>{accounts.filter((item) => item.entityId !== accountId).map((item) => <Choice key={item.entityId} active={destinationAccountId === item.entityId} label={`${accountName(item)} · ${currency(item)}`} onPress={() => setDestinationAccountId(item.entityId)} theme={theme} />)}</View></> : null}
        {type !== "transfer" ? <><FieldLabel label="Catégorie" color={theme.label} /><View style={styles.choiceGrid}>{availableCategories.map((item) => <Choice key={item.entityId} active={categoryId === item.entityId} label={item.name} onPress={() => setCategoryId(item.entityId)} theme={theme} />)}</View></> : null}
        <FieldLabel label={`Montant${source ? ` (${currency(source)})` : ""}`} color={theme.label} /><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal" placeholder="0,00" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator }]} />
        {type === "transfer" ? <><FieldLabel label={`Montant crédité${destination ? ` (${currency(destination)})` : ""}`} color={theme.label} /><TextInput value={destinationAmount} onChangeText={setDestinationAmount} keyboardType="decimal-pad" inputMode="decimal" placeholder={crossCurrency ? "Saisir le montant cible" : "Même montant automatiquement"} placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator }]} /><FieldLabel label={`Frais${source ? ` (${currency(source)})` : ""}`} color={theme.label} /><TextInput value={fee} onChangeText={setFee} keyboardType="decimal-pad" inputMode="decimal" placeholder="Facultatif" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator }]} /></> : null}
        <FieldLabel label="Date et heure" color={theme.label} /><TextInput value={date} onChangeText={setDate} placeholder="AAAA-MM-JJTHH:MM" style={[styles.input, { color: theme.label, borderColor: theme.separator }]} />
        <FieldLabel label="Libellé" color={theme.label} /><TextInput value={merchant} onChangeText={setMerchant} placeholder="Ex. Courses, salaire…" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator }]} />
        <FieldLabel label="Note (facultatif)" color={theme.label} /><TextInput value={note} onChangeText={setNote} placeholder="Ajouter un détail" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator }]} />
        <FieldLabel label="Tags (facultatif)" color={theme.label} /><TextInput value={tagsInput} onChangeText={setTagsInput} placeholder="Ex. maison, urgent (séparés par des virgules)" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator }]} />
        {type !== "transfer" ? <>
          <Pressable onPress={() => setSplitEnabled((value) => !value)} accessibilityRole="switch" accessibilityState={{ checked: splitEnabled }} style={[styles.advanced, { borderColor: theme.separator }]}>
            <Text style={{ color: theme.label, fontWeight: "700" }}>{splitEnabled ? "Désactiver le fractionnement" : "Fractionner entre plusieurs catégories"}</Text>
          </Pressable>
          {splitEnabled ? <View style={styles.advancedBody}>{splitRows.map((row, index) => <View key={index} style={styles.splitRow}>
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Répartition {index + 1}</Text>
            <View style={styles.choiceGrid}>{availableCategories.map((item) => <Choice key={item.entityId} active={row.categoryId === item.entityId} label={item.name} onPress={() => setSplitRows((current) => current.map((entry, rowIndex) => rowIndex === index ? { ...entry, categoryId: item.entityId } : entry))} theme={theme} />)}</View>
            <TextInput value={row.amount} onChangeText={(value) => setSplitRows((current) => current.map((entry, rowIndex) => rowIndex === index ? { ...entry, amount: value } : entry))} placeholder="Montant" placeholderTextColor={theme.secondaryLabel} keyboardType="decimal-pad" style={[styles.input, { color: theme.label, borderColor: theme.separator }]} />
          </View>)}<Pressable onPress={() => setSplitRows((current) => [...current, { categoryId: "", amount: "" }])}><Text style={{ color: theme.accent, fontWeight: "700" }}>Ajouter une répartition</Text></Pressable></View> : null}
          <Pressable onPress={() => setReimbursementEnabled((value) => !value)} accessibilityRole="switch" accessibilityState={{ checked: reimbursementEnabled }} style={[styles.advanced, { borderColor: theme.separator }]}>
            <Text style={{ color: theme.label, fontWeight: "700" }}>{reimbursementEnabled ? "Désactiver le remboursement" : "Ajouter un remboursement"}</Text>
          </Pressable>
          {reimbursementEnabled ? <View style={styles.advancedBody}><TextInput value={reimbursementPerson} onChangeText={setReimbursementPerson} placeholder="Personne concernée" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator }]} /><TextInput value={reimbursementAmount} onChangeText={setReimbursementAmount} placeholder="Montant remboursable" placeholderTextColor={theme.secondaryLabel} keyboardType="decimal-pad" style={[styles.input, { color: theme.label, borderColor: theme.separator }]} /></View> : null}
        </> : null}
        <ActionButton label={saving ? "Enregistrement…" : "Enregistrer l’opération"} onPress={() => void save()} disabled={saving || accounts.length === 0} />
      </View>
    </ScrollView>
  );
}

function FieldLabel({ label, color }: { label: string; color: string }) { return <Text style={[styles.label, { color }]}>{label}</Text>; }
function Choice({ active, label, onPress, theme }: { active: boolean; label: string; onPress: () => void; theme: ReturnType<typeof useTheme> }) { return <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: active }} style={[styles.choice, { backgroundColor: active ? theme.accent : theme.surface, borderColor: active ? theme.accent : theme.separator }]}><Text style={{ color: active ? theme.onAccent : theme.label, fontWeight: "700" }}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.md }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { ...typography.display }, lead: { maxWidth: 720, fontSize: 15, lineHeight: 22, marginBottom: spacing.md }, card: { maxWidth: 820, gap: spacing.md, borderWidth: 1, borderRadius: 16, padding: spacing.xl }, label: { fontSize: 13, fontWeight: "700", marginTop: spacing.sm }, typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, typeChoice: { flexGrow: 1, minWidth: 180, borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: 5 }, typeLabel: { fontSize: 15, fontWeight: "800" }, choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, choice: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11 }, input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 }, advanced: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 13 }, advancedBody: { gap: spacing.sm }, splitRow: { gap: spacing.sm }, state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
}) as any;
