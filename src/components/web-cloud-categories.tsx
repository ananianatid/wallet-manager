import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { deleteCloudEntity, loadCloudBootstrap, upsertCloudEntity } from "@/cloud/api";
import { toCloudCategory, type CloudCategory } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icons";
import { DEFAULT_CATEGORY_ICON } from "@/constants/category-icons";
import { spacing, typography, useTheme } from "@/theme";

export default function WebCloudCategories() {
  const theme = useTheme();
  const [items, setItems] = useState<CloudCategory[]>([]);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await loadCloudBootstrap(["categories"]);
      setItems(result.entities.filter((entity) => entity.payload !== null).map(toCloudCategory));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de charger les catégories."); }
    finally { setLoading(false); }
  }, []);
  // The first remote load intentionally synchronizes component state after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => items.filter((item) => item.type === type), [items, type]);
  const save = async () => {
    if (!name.trim()) return setError("Saisissez un nom de catégorie.");
    if (visible.some((item) => item.name.toLocaleLowerCase("fr") === name.trim().toLocaleLowerCase("fr"))) return setError("Cette catégorie existe déjà.");
    setBusy(true); setError(null);
    try {
      await upsertCloudEntity({ entityType: "categories", entityId: randomUUID(), baseVersion: 0, payload: { fields: { type, name: name.trim(), is_seed: 0, icon: DEFAULT_CATEGORY_ICON }, refs: {} } });
      setName(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de créer la catégorie."); }
    finally { setBusy(false); }
  };
  const rename = async (item: CloudCategory) => {
    const next = typeof window !== "undefined" ? window.prompt("Nouveau nom de catégorie", item.name)?.trim() : null;
    if (!next || next === item.name) return;
    setBusy(true); setError(null);
    try { await upsertCloudEntity({ entityType: "categories", entityId: item.entityId, baseVersion: item.version, payload: { fields: { type: item.type, name: next, is_seed: item.isSeed ? 1 : 0, icon: item.icon }, refs: {} } }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de renommer la catégorie."); }
    finally { setBusy(false); }
  };
  const remove = async (item: CloudCategory) => {
    if (item.isSeed || (typeof window !== "undefined" && !window.confirm(`Supprimer « ${item.name} » ?`))) return;
    setBusy(true); setError(null);
    try { await deleteCloudEntity({ entityType: "categories", entityId: item.entityId, baseVersion: item.version }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de supprimer la catégorie."); }
    finally { setBusy(false); }
  };

  if (loading) return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={{ color: theme.label }}>Chargement des catégories…</Text></View>;
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
    <Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>RÉGLAGES · DONNÉES MÉTIER</Text><Text style={[styles.title, { color: theme.label }]}>Catégories</Text>
    <Text style={[styles.lead, { color: theme.secondaryLabel }]}>Les catégories structurent vos revenus et vos dépenses sur mobile et sur le web.</Text>
    {error ? <InlineError message={error} onRetry={() => void load()} /> : null}
    <View style={styles.tabs}>{([["expense", "Dépenses"], ["income", "Revenus"]] as const).map(([value, label]) => <Pressable key={value} onPress={() => setType(value)} style={[styles.tab, { borderColor: type === value ? theme.accent : theme.separator, backgroundColor: type === value ? theme.accent : theme.surface }]}><Text style={{ color: type === value ? theme.onAccent : theme.label, fontWeight: "800" }}>{label}</Text></Pressable>)}</View>
    <View style={[styles.create, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.sectionTitle, { color: theme.label }]}>Nouvelle catégorie</Text><TextInput value={name} onChangeText={setName} placeholder={type === "expense" ? "Ex. Abonnements" : "Ex. Prime"} placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator }]} /><ActionButton label={busy ? "Enregistrement…" : "Ajouter la catégorie"} onPress={() => void save()} disabled={busy} /></View>
    <View style={styles.list}>{visible.map((item) => <View key={item.entityId} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.separator }]}><View style={[styles.icon, { backgroundColor: theme.surfaceElevated }]}><CategoryIcon name={item.icon ?? DEFAULT_CATEGORY_ICON} size={18} color={theme.accent} /></View><Text style={[styles.rowName, { color: theme.label }]}>{item.name}</Text><Pressable onPress={() => void rename(item)} accessibilityRole="button" accessibilityLabel={`Renommer ${item.name}`}><Text style={{ color: theme.accent, fontWeight: "700" }}>Renommer</Text></Pressable>{!item.isSeed ? <Pressable onPress={() => void remove(item)} accessibilityRole="button" accessibilityLabel={`Supprimer ${item.name}`}><Text style={{ color: theme.expense, fontWeight: "700" }}>Supprimer</Text></Pressable> : null}</View>)}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: spacing.xl, gap: spacing.md }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { ...typography.display }, lead: { fontSize: 15, lineHeight: 22, maxWidth: 680 }, tabs: { flexDirection: "row", gap: spacing.sm }, tab: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 }, create: { maxWidth: 700, borderWidth: 1, borderRadius: 16, padding: spacing.xl, gap: spacing.md }, sectionTitle: { fontSize: 17, fontWeight: "800" }, input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 }, list: { maxWidth: 900, gap: spacing.sm }, row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 12, padding: spacing.md }, icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 }, rowName: { flex: 1, fontSize: 15, fontWeight: "700" }, state: { flex: 1, alignItems: "center", justifyContent: "center" },
}) as any;
