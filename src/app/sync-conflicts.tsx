import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { type SyncConflict } from "@/cloud/sync";
import { loadLocalSyncConflicts, resolveLocalSyncConflict } from "@/data/sync-conflicts";
import { humanEntityLabel, formatConflictPayload } from "@/cloud/conflict-format";
import { spacing, typography, useTheme, withAlpha } from "@/theme";

export default function SyncConflictsScreen() {
  const theme = useTheme();
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setConflicts(await loadLocalSyncConflicts());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lecture des conflits impossible.");
    }
  }, []);

  // This effect reads persisted SQLite state when the screen mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const resolve = async (conflict: SyncConflict, choice: "server" | "local") => {
    const key = `${conflict.entityType}:${conflict.entityId}`;
    setBusyKey(key);
    setError(null);
    try {
      await resolveLocalSyncConflict(conflict, choice);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Résolution impossible.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Conflits de synchronisation" }} />
      <KeyboardAwareScreen contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.title, { color: theme.label }]}>Choisissez quelle version garder</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Wallet ne remplace pas silencieusement une modification faite sur un autre appareil.</Text>
        </View>
        {error ? <InlineError message={error} onRetry={() => { setError(null); void load(); }} /> : null}
        {conflicts.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface }]}><Text style={[styles.cardTitle, { color: theme.label }]}>Aucun conflit en attente</Text><Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Vos appareils sont synchronisés.</Text></View>
        ) : conflicts.map((conflict) => {
          const key = `${conflict.entityType}:${conflict.entityId}`;
          const rows = formatConflictPayload(conflict.serverPayload);
          return (
            <View key={key} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: theme.label }]}>{humanEntityLabel(conflict.entityType)}</Text>
                <View style={[styles.badge, { backgroundColor: withAlpha(theme.warning, "16") }]}>
                  <Text style={[styles.badgeLabel, { color: theme.warning }]}>Conflit</Text>
                </View>
              </View>
              <Text style={[styles.meta, { color: theme.secondaryLabel }]}>Version distante · v{conflict.serverVersion} · ID {conflict.entityId.slice(0, 8)}</Text>
              <View style={[styles.payloadBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.separator }]}>
                {rows.map((row) => (
                  <View key={row.label} style={styles.payloadRow}>
                    <Text style={[styles.payloadLabel, { color: theme.secondaryLabel }]}>{row.label}</Text>
                    <Text style={[styles.payloadValue, { color: theme.label }]} numberOfLines={2}>{row.value}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.hint, { color: theme.secondaryLabel }]}>
                Choisissez quelle version conserver. L’autre sera écrasée lors de la prochaine synchronisation.
              </Text>
              <ActionButton label={busyKey === key ? "Résolution…" : "Garder la version distante"} onPress={() => void resolve(conflict, "server")} disabled={busyKey !== null} />
              <ActionButton label="Garder ma version locale" variant="secondary" onPress={() => void resolve(conflict, "local")} disabled={busyKey !== null} />
            </View>
          );
        })}
      </KeyboardAwareScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { gap: spacing.sm },
  title: { ...typography.display },
  subtitle: { ...typography.body, lineHeight: 22 },
  card: { padding: spacing.lg, borderRadius: 20, gap: spacing.md, borderWidth: StyleSheet.hairlineWidth },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { ...typography.section, flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  meta: { fontSize: 12 },
  hint: { fontSize: 12, lineHeight: 17 },
  payloadBox: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.sm },
  payloadRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  payloadLabel: { fontSize: 12, fontWeight: "600", flex: 1 },
  payloadValue: { fontSize: 12, fontWeight: "500", flex: 1.4, textAlign: "right" },
});
