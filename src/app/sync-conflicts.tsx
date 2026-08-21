import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { getDatabase } from "@/db/database";
import { listSyncConflicts, resolveSyncConflict, type SyncConflict } from "@/cloud/sync";
import { spacing, typography, useTheme } from "@/theme";

export default function SyncConflictsScreen() {
  const theme = useTheme();
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setConflicts(await listSyncConflicts(await getDatabase()));
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
      await resolveSyncConflict(await getDatabase(), conflict, choice);
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
          <View style={[styles.card, { backgroundColor: theme.surface }]}><Text style={[styles.cardTitle, { color: theme.label }]}>Aucun conflit en attente</Text></View>
        ) : conflicts.map((conflict) => {
          const key = `${conflict.entityType}:${conflict.entityId}`;
          return (
            <View key={key} style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.label }]}>{conflict.entityType}</Text>
              <Text style={[styles.meta, { color: theme.secondaryLabel }]}>Version distante : {conflict.serverVersion}</Text>
              <Text style={[styles.payload, { color: theme.secondaryLabel }]} numberOfLines={5}>{JSON.stringify(conflict.serverPayload)}</Text>
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
  card: { padding: spacing.lg, borderRadius: 20, gap: spacing.sm },
  cardTitle: { ...typography.section },
  meta: { fontSize: 13 },
  payload: { fontFamily: "monospace", fontSize: 12, lineHeight: 17 },
});
