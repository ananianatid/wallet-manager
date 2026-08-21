import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { recoverCloudAccount } from "@/cloud/api";
import { ActionButton, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { spacing, typography, useTheme } from "@/theme";

export default function RecoverAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recover = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await recoverCloudAccount(token);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Récupération impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Récupérer le compte" }} />
      <KeyboardAwareScreen contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {error ? <InlineError message={error} onRetry={() => setError(null)} /> : null}
          <Text style={[styles.title, { color: theme.label }]}>{done ? "Compte récupéré" : "Annuler la suppression"}</Text>
          <Text style={[styles.body, { color: theme.secondaryLabel }]}>{done ? "Votre compte est restauré. Vous pouvez revenir à Wallet et vous reconnecter." : "Ce lien est valable pendant 30 jours après la demande de suppression."}</Text>
          {done ? <ActionButton label="Retour au compte" onPress={() => router.replace("/cloud-account")} /> : <ActionButton label={busy ? "Récupération…" : "Récupérer mon compte"} onPress={() => void recover()} disabled={busy || !token} />}
        </View>
      </KeyboardAwareScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { padding: spacing.lg, borderRadius: 20, gap: spacing.md },
  title: { ...typography.display },
  body: { ...typography.body, lineHeight: 22 },
});
