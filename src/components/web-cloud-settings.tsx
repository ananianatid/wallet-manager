import { router } from "expo-router";
import { ChevronRight, LogOut, RefreshCw, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCloudAuth } from "@/cloud/auth-context";
import { ActionButton, InlineError } from "@/components/ui";
import { spacing, typography, useTheme } from "@/theme";

export default function WebCloudSettings() {
  const theme = useTheme();
  const { user, signOut, refreshUser } = useCloudAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try { await refreshUser(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de vérifier votre session."); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    setBusy(true);
    try { await signOut(); router.replace("/cloud-account"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de fermer la session."); setBusy(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>COMPTE CLOUD</Text>
      <Text style={[styles.title, { color: theme.label }]}>Réglages</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
        <ShieldCheck color={theme.accent} size={26} />
        <View style={styles.copy}>
          <Text style={[styles.cardTitle, { color: theme.label }]}>Espace PostgreSQL sécurisé</Text>
          <Text style={[styles.cardBody, { color: theme.secondaryLabel }]}>{user?.email ?? "Compte connecté"}</Text>
          <Text style={[styles.cardBody, { color: theme.secondaryLabel }]}>Vos données web sont chargées depuis votre espace cloud, pas depuis SQLite.</Text>
        </View>
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel="Gérer les catégories" onPress={() => router.push("/app/categories" as never)} style={[styles.categoryLink, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
        <View style={styles.copy}><Text style={[styles.cardTitle, { color: theme.label }]}>Catégories</Text><Text style={[styles.cardBody, { color: theme.secondaryLabel }]}>Gérez les catégories utilisées par vos revenus et dépenses.</Text></View><ChevronRight size={19} color={theme.accent} />
      </Pressable>
      {error ? <InlineError message={error} onRetry={() => void refresh()} /> : null}
      <View style={styles.actions}>
        <ActionButton label={busy ? "Actualisation…" : "Actualiser la session"} onPress={() => void refresh()} disabled={busy} />
        <Pressable accessibilityRole="button" accessibilityLabel="Se déconnecter" onPress={() => void logout()} style={[styles.logout, { borderColor: theme.separator }]}>
          <LogOut size={17} color={theme.label} />
          <Text style={[styles.logoutText, { color: theme.label }]}>Se déconnecter</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, gap: spacing.md },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { ...typography.display, marginBottom: spacing.md },
  card: { maxWidth: 720, flexDirection: "row", gap: spacing.md, borderWidth: 1, borderRadius: 20, padding: spacing.xl },
  copy: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 18, fontWeight: "800" },
  cardBody: { fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  categoryLink: { maxWidth: 720, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 16, padding: spacing.xl },
  logout: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16 },
  logoutText: { fontSize: 14, fontWeight: "700" },
});
