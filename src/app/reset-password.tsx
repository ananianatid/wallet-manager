import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { resetPassword } from "@/cloud/api";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { spacing, typography, useTheme } from "@/theme";

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!params.token || password.length < 8 || password !== confirmation) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword(params.token, password);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Réinitialisation impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Nouveau mot de passe" }} />
      <KeyboardAwareScreen contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.title, { color: theme.label }]}>Réinitialiser le mot de passe</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Choisissez un nouveau mot de passe pour votre compte Wallet.</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {done ? (
            <>
              <Text style={[styles.cardTitle, { color: theme.label }]}>Mot de passe modifié</Text>
              <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Vous pouvez maintenant vous reconnecter avec votre nouveau mot de passe.</Text>
              <ActionButton label="Retour au compte" onPress={() => router.replace("/cloud-account")} />
            </>
          ) : (
            <>
              {error ? <InlineError message={error} onRetry={() => setError(null)} /> : null}
              <FormField label="Nouveau mot de passe" hint="8 caractères minimum.">
                <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="Votre nouveau mot de passe" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator, backgroundColor: theme.background }]} />
              </FormField>
              <FormField label="Confirmer le mot de passe">
                <TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" placeholder="Répétez le mot de passe" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator, backgroundColor: theme.background }]} />
              </FormField>
              {confirmation.length > 0 && password !== confirmation ? <Text style={[styles.errorHint, { color: theme.expense }]}>Les mots de passe ne correspondent pas.</Text> : null}
              <ActionButton label={busy ? "Modification…" : "Enregistrer le nouveau mot de passe"} onPress={() => void submit()} disabled={busy || !params.token || password.length < 8 || password !== confirmation} />
            </>
          )}
        </View>
      </KeyboardAwareScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl },
  intro: { gap: spacing.sm },
  title: { ...typography.display },
  subtitle: { ...typography.body, lineHeight: 22 },
  card: { padding: spacing.lg, borderRadius: 20, gap: spacing.md },
  cardTitle: { ...typography.section },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: 16 },
  errorHint: { fontSize: 13 },
});
