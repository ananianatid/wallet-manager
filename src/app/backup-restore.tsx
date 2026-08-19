import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert, StyleSheet, Text, TextInput,
} from "react-native";
import {
  applyRestoredBackup,
  readRestoredBackup,
  type RestoredBackupInfo,
} from "@/backup/restore";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { radius, spacing, typography, useTheme } from "@/theme";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

export default function BackupRestoreScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ uri?: string }>();
  const uri = params.uri ?? "";
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRestore = async () => {
    if (!uri) {
      setError("Fichier manquant. Revenez en arrière et choisissez un fichier.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const restored = await readRestoredBackup(uri, passphrase);
      const confirmed = await confirmReplacement(restored.info);
      if (!confirmed) {
        return;
      }
      await applyRestoredBackup(restored.plaintext);
      Alert.alert(
        "Restauration terminée",
        "Vos données ont été remplacées par la sauvegarde.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e) {
      log.error("backup.restore", "Échec de la restauration de la sauvegarde", e);
      setError(userMessage(e, "La restauration a échoué."));
    } finally {
      setBusy(false);
    }
  };

  const confirmReplacement = (info: RestoredBackupInfo): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        "Remplacer les données actuelles ?",
        `Cette sauvegarde contient ${info.transactionCount} transactions (v${info.userVersion}).\n\nLa restauration remplace toutes vos données actuelles.`,
        [
          { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
          { text: "Remplacer", style: "destructive", onPress: () => resolve(true) },
        ],
      );
    });

  return (
    <>
      <Stack.Screen options={{ title: "Restaurer une sauvegarde" }} />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: theme.label }]}>Restaurer une sauvegarde</Text>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 18 }}>
          Restaure les comptes, catégories, budgets et transactions depuis un fichier
          « .wlbak ». La restauration remplace définitivement les données actuelles :
          exportez une sauvegarde avant si nécessaire.
        </Text>
        {error ? <InlineError message={error} /> : null}
        <FormField label="Mot de passe de la sauvegarde">
          <TextInput
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Mot de passe"
            placeholderTextColor={theme.secondaryLabel}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={256}
            accessibilityLabel="Mot de passe de la sauvegarde"
            style={{
              color: theme.label,
              backgroundColor: theme.surface,
              borderColor: theme.separator,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.md,
              minHeight: 48,
              paddingHorizontal: spacing.lg,
              fontSize: 16,
            }}
          />
        </FormField>
        <ActionButton
          label={busy ? "Restauration…" : "Restaurer"}
          variant="destructive"
          onPress={() => void onRestore()}
          disabled={busy || passphrase.length === 0}
        />
      </KeyboardAwareScreen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    flexGrow: 1,
  },
  title: { ...typography.title },
});
