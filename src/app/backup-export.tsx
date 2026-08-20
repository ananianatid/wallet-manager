import { Stack, router } from "expo-router";
import { useState } from "react";
import {
  Alert, StyleSheet, Text, TextInput,
} from "react-native";
import { exportEncryptedBackup } from "@/backup/export";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { radius, spacing, typography, useTheme } from "@/theme";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

const MIN_PASSPHRASE_LENGTH = 8;

interface PassphraseInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}

function PassphraseInput({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: PassphraseInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.secondaryLabel}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={256}
      accessibilityLabel={accessibilityLabel}
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
  );
}

export default function BackupExportScreen() {
  const theme = useTheme();
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExport = async () => {
    setError(null);
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError(
        `Le mot de passe doit contenir au moins ${MIN_PASSPHRASE_LENGTH} caractères.`,
      );
      return;
    }
    if (passphrase !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const name = await exportEncryptedBackup(passphrase);
      setPassphrase("");
      setConfirmation("");
      Alert.alert(
        "Sauvegarde créée",
        `Le fichier « ${name} » est prêt. Enregistrez-le dans un endroit sûr (Drive, carte SD, ordinateur…).\n\nSans ce mot de passe, personne — y compris vous — ne pourra lire la sauvegarde.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e) {
      log.error("backup.export", "Échec de l'export de la sauvegarde", e);
      setError(userMessage(e, "L'export a échoué."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Exporter une sauvegarde" }} />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: theme.label }]}>Créer une sauvegarde chiffrée</Text>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 18 }}>
          Crée un fichier « .wlbak » chiffré (AES-256) contenant toutes vos données.
          Le mot de passe ne peut pas être récupéré : notez-le précieusement.
        </Text>
        {error ? <InlineError message={error} /> : null}
        <FormField
          label="Mot de passe"
          hint={`Au moins ${MIN_PASSPHRASE_LENGTH} caractères`}
        >
          <PassphraseInput
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Choisissez un mot de passe"
            accessibilityLabel="Mot de passe de la sauvegarde"
          />
        </FormField>
        <FormField label="Confirmation">
          <PassphraseInput
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="Répétez le mot de passe"
            accessibilityLabel="Confirmation du mot de passe"
          />
        </FormField>
        <ActionButton
          label={busy ? "Création…" : "Exporter"}
          onPress={() => void onExport()}
          disabled={busy}
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
