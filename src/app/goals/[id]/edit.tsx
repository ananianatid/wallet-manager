import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen, ScreenState } from "@/components/ui";
import { loadGoalDetail, updateLocalGoal } from "@/data/goals";
import { currencyDigits, parseMoneyInput } from "@/currency/currencies";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import { formatAmount, formatDate } from "@/utils/format";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";
import { isValidGoalLink } from "@/utils/goals";

export default function EditGoalScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goalId = Number(id);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { goal } = await loadGoalDetail(goalId);
    if (goal) {
      setName(goal.name);
      setTargetAmount((goal.targetAmount / 10 ** currencyDigits(goal.currencyCode)).toString());
      setTargetDate(new Date(goal.targetDate));
      setDescription(goal.description ?? "");
      setLinkUrl(goal.linkUrl ?? "");
      setImageUri(goal.imageUri ?? null);
    }
    return { goal };
  }, [goalId]);

  const resource = useAsyncResource(load, "goals.edit");
  const reload = resource.reload;
  const goal = resource.data?.goal ?? null;
  const goalCurrency = goal?.currencyCode ?? "XOF";
  const previewAmount = parseMoneyInput(targetAmount, goalCurrency);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const save = async () => {
    const amount = parseMoneyInput(targetAmount, goal?.currencyCode ?? "XOF");
    if (!name.trim()) {
      Alert.alert("Nom manquant", "Donnez un nom à votre objectif.");
      return;
    }
    if (amount == null || Number.isNaN(amount) || amount <= 0) {
      Alert.alert("Montant invalide", `Saisissez un montant positif en ${goal?.currencyCode ?? "XOF"}.`);
      return;
    }
    if (linkUrl.trim() && !isValidGoalLink(linkUrl)) {
      Alert.alert("Lien invalide", "Utilisez une adresse commençant par http:// ou https://.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateLocalGoal(goalId, {
        name,
        description,
        imageUri,
        linkUrl,
        targetAmount: amount,
        currencyCode: goal?.currencyCode ?? "XOF",
        targetDate: targetDate.getTime(),
      });
      router.back();
    } catch (e) {
      setSaveError(userMessage(e, "Impossible de modifier l'objectif."));
      log.error("goals.update", "Échec de la modification de l'objectif", e);
      setSaving(false);
    }
  };

  const chooseImage = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "image/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Modifier l'objectif" }} />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={userMessage(resource.error)}
          onRetry={() => void resource.reload()}
        />
      ) : !goal ? (
        <ScreenState status="error" message="Cet objectif est introuvable." />
      ) : (
        <KeyboardAwareScreen
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        >
          {saveError ? <InlineError message={saveError} onRetry={() => setSaveError(null)} /> : null}

          <FormField label="Nom de l'objectif" hint="Un nom court vous aidera à le retrouver rapidement.">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex. : PS5"
              placeholderTextColor={theme.secondaryLabel}
              accessibilityLabel="Nom de l'objectif"
              maxLength={40}
              returnKeyType="next"
              style={[styles.input, { backgroundColor: theme.surface, color: theme.label }]}
            />
          </FormField>

          <FormField label="Montant à réserver">
            <View style={[styles.amountCard, { backgroundColor: theme.surfaceElevated }]}>
              <TextInput
                value={targetAmount}
                onChangeText={setTargetAmount}
                placeholder="350000"
                placeholderTextColor={theme.secondaryLabel}
                keyboardType="number-pad"
                inputMode="numeric"
                returnKeyType="done"
                accessibilityLabel={`Montant cible en ${goalCurrency}`}
                style={[styles.amountInput, { color: theme.label }]}
              />
              <Text style={{ color: theme.secondaryLabel }}>{goalCurrency} à réserver</Text>
              {previewAmount != null && !Number.isNaN(previewAmount) && previewAmount > 0 ? (
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                  Cible : {formatAmount(previewAmount, goalCurrency)}
                </Text>
              ) : null}
            </View>
          </FormField>

          <FormField label="Date cible">
            <Pressable
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Date cible ${formatDate(targetDate.getTime())}`}
              accessibilityHint="Ouvre le sélecteur de date."
              style={({ pressed }) => [
                styles.dateButton,
                { backgroundColor: theme.surface, borderColor: theme.separator },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: theme.label, fontWeight: "600" }}>
                {formatDate(targetDate.getTime())}
              </Text>
            </Pressable>
          </FormField>

          {showDatePicker ? (
            <DateTimePicker
              mode="date"
              value={targetDate}
              onValueChange={(_, date) => {
                setShowDatePicker(false);
                if (date) setTargetDate(date);
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          ) : null}

          <FormField label="Description (optionnelle)">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Pourquoi cet objectif compte pour vous ?"
              placeholderTextColor={theme.secondaryLabel}
              multiline
              maxLength={500}
              accessibilityLabel="Description de l’objectif"
              style={[styles.input, styles.multilineInput, { backgroundColor: theme.surface, color: theme.label }]}
            />
          </FormField>

          <FormField label="Lien (optionnel)">
            <TextInput
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://…"
              placeholderTextColor={theme.secondaryLabel}
              autoCapitalize="none"
              keyboardType="url"
              inputMode="url"
              accessibilityLabel="Lien de l’objectif"
              style={[styles.input, { backgroundColor: theme.surface, color: theme.label }]}
            />
          </FormField>

          <View style={[styles.attachmentRow, { backgroundColor: theme.surfaceElevated }]}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={{ color: theme.label, fontWeight: "700" }}>Image de référence</Text>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                {imageUri ? "Une image locale est sélectionnée." : "Aucune image sélectionnée."}
              </Text>
            </View>
            <Pressable
              onPress={chooseImage}
              accessibilityRole="button"
              accessibilityLabel={imageUri ? "Remplacer l’image de l’objectif" : "Ajouter une image à l’objectif"}
              style={({ pressed }) => [styles.attachmentButton, { backgroundColor: theme.accent }, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: theme.onAccent, fontWeight: "700" }}>{imageUri ? "Remplacer" : "Ajouter"}</Text>
            </Pressable>
          </View>

          <View style={[styles.info, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={{ color: theme.label, fontWeight: "700" }}>Comment ça marche</Text>
            <Text style={{ color: theme.secondaryLabel, lineHeight: 18 }}>
              La modification ne touche pas aux réservations déjà effectuées. Déjà {formatAmount(goal.reservedAmount, goal.currencyCode)} réservés sur {formatAmount(goal.targetAmount, goal.currencyCode)}.
            </Text>
          </View>

          <ActionButton
            onPress={save}
            disabled={saving}
            label={saving ? "Enregistrement…" : "Enregistrer"}
          />
        </KeyboardAwareScreen>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
  },
  amountCard: {
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    minWidth: 200,
  },
  dateButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  info: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  attachmentButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
