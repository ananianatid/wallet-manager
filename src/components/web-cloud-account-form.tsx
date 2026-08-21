import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { upsertCloudEntity } from "@/cloud/api";
import { ActionButton, InlineError } from "@/components/ui";
import { spacing, typography, useTheme } from "@/theme";

export default function WebCloudAccountForm() {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!name.trim()) { setError("Saisissez un nom de compte."); return; }
    setSaving(true); setError(null);
    try {
      const now = Date.now();
      await upsertCloudEntity({ entityType: "accounts", entityId: randomUUID(), baseVersion: 0, payload: { fields: { name: name.trim(), currency_code: currency.trim().toUpperCase() || "XOF", hidden: 0, exclude_from_total: 0, description: null, created_at: now, deleted_at: null }, refs: { category_id: null, group_id: null } } });
      router.replace("/app/accounts");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible d’enregistrer le compte cloud."); }
    finally { setSaving(false); }
  };
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>ESPACE CLOUD</Text><Text style={[styles.title, { color: theme.label }]}>Nouveau compte</Text>{error ? <InlineError message={error} /> : null}<View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.label, { color: theme.label }]}>Nom du compte</Text><TextInput value={name} onChangeText={setName} placeholder="Ex. Compte courant" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator }]} /><Text style={[styles.label, { color: theme.label }]}>Devise</Text><TextInput value={currency} onChangeText={setCurrency} autoCapitalize="characters" style={[styles.input, { color: theme.label, borderColor: theme.separator }]} /><ActionButton label={saving ? "Enregistrement…" : "Créer le compte cloud"} onPress={() => void save()} disabled={saving} /></View></ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.md },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { ...typography.display, marginBottom: spacing.md },
  card: { maxWidth: 620, gap: spacing.md, borderWidth: 1, borderRadius: 20, padding: spacing.xl },
  label: { fontSize: 13, fontWeight: "700" },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
}) as any;
