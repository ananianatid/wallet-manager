import DateTimePicker from "@react-native-community/datetimepicker";
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
import { getDatabase } from "@/db/database";
import { getGoal, updateGoal } from "@/db/goals";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import { formatAmount, formatDate } from "@/utils/format";

export default function EditGoalScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goalId = Number(id);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const goal = await getGoal(db, goalId);
    if (goal) {
      setName(goal.name);
      setTargetAmount(String(goal.targetAmount));
      setTargetDate(new Date(goal.targetDate));
    }
    return { goal };
  }, [goalId]);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const goal = resource.data?.goal ?? null;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const save = async () => {
    const amount = Number(targetAmount);
    if (!name.trim()) {
      Alert.alert("Nom manquant", "Donnez un nom à votre objectif.");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      Alert.alert("Montant invalide", "Saisissez un montant entier positif en FCFA.");
      return;
    }
    const isOverdue = goal != null && goal.targetDate < Date.now();
    if (!isOverdue && targetDate.getTime() <= Date.now()) {
      Alert.alert("Date invalide", "Choisissez une date future.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const db = await getDatabase();
      await updateGoal(db, goalId, {
        name,
        targetAmount: amount,
        targetDate: targetDate.getTime(),
      });
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Impossible de modifier l'objectif.");
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Modifier l'objectif" }} />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={resource.error?.message}
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

          <FormField label="Nom de l'objectif">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex. : PS5"
              placeholderTextColor={theme.secondaryLabel}
              accessibilityLabel="Nom de l'objectif"
              style={[styles.input, { backgroundColor: theme.surface, color: theme.label }]}
            />
          </FormField>

          <FormField label="Montant à réserver">
            <View style={styles.amountCard}>
              <TextInput
                value={targetAmount}
                onChangeText={setTargetAmount}
                placeholder="350000"
                placeholderTextColor={theme.secondaryLabel}
                keyboardType="number-pad"
                inputMode="numeric"
                accessibilityLabel="Montant cible en FCFA"
                style={[styles.amountInput, { color: theme.label }]}
              />
              <Text style={{ color: theme.secondaryLabel }}>FCFA à réserver</Text>
              {Number(targetAmount) > 0 ? (
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                  Cible : {formatAmount(Number(targetAmount))}
                </Text>
              ) : null}
            </View>
          </FormField>

          <FormField label="Date cible">
            <Pressable
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Date cible ${formatDate(targetDate.getTime())}`}
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
              minimumDate={new Date()}
              onValueChange={(_, date) => {
                setShowDatePicker(false);
                if (date) setTargetDate(date);
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          ) : null}

          <View style={[styles.info, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={{ color: theme.label, fontWeight: "700" }}>Comment ça marche</Text>
            <Text style={{ color: theme.secondaryLabel, lineHeight: 18 }}>
              La modification ne touche pas aux réservations déjà effectuées. Déjà {formatAmount(goal.reservedAmount)} réservés sur {formatAmount(goal.targetAmount)}.
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
  },
  amountCard: {
    alignItems: "center",
    gap: spacing.xs,
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
});
