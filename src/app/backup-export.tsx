import { Stack, router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { exportEncryptedBackup } from "@/backup/export";
import { ActionButton, FormField, InlineError } from "@/components/ui";
import { radius, spacing, useTheme } from "@/theme";

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
      setError(e instanceof Error ? e.message : "L'export a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Exporter une sauvegarde" }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
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
          label="Exporter"
          onPress={() => void onExport()}
          disabled={busy}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
