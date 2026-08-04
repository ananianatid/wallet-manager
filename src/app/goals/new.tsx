import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createGoal } from "@/db/goals";
import { getDatabase } from "@/db/database";
import { radius, spacing, useTheme } from "@/theme";
import { formatAmount, formatDate } from "@/utils/format";

export default function NewGoalScreen() {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (targetDate.getTime() <= Date.now()) {
      Alert.alert("Date invalide", "Choisissez une date future.");
      return;
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      await createGoal(db, {
        name,
        targetAmount: amount,
        targetDate: targetDate.getTime(),
      });
      router.back();
    } catch (e) {
      Alert.alert(
        "Impossible de créer l'objectif",
        e instanceof Error ? e.message : "Une erreur est survenue.",
      );
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Nouvel objectif" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Nom de l&apos;objectif</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex. : PS5"
            placeholderTextColor={theme.secondaryLabel}
            style={[styles.input, { backgroundColor: theme.surface, color: theme.label }]}
            autoFocus
          />
        </View>

        <View style={styles.amountCard}>
          <TextInput
            value={targetAmount}
            onChangeText={setTargetAmount}
            placeholder="350000"
            placeholderTextColor={theme.secondaryLabel}
            keyboardType="number-pad"
            inputMode="numeric"
            style={[styles.amountInput, { color: theme.label }]}
          />
          <Text style={{ color: theme.secondaryLabel }}>FCFA à réserver</Text>
          {Number(targetAmount) > 0 ? (
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
              Cible : {formatAmount(Number(targetAmount))}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Date cible</Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
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
        </View>

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
            Une réservation retire la somme du solde disponible de votre compte, sans modifier son solde total.
          </Text>
        </View>

        <Pressable
          onPress={save}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.accent },
            (pressed || saving) && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.saveLabel}>{saving ? "Création…" : "Créer l'objectif"}</Text>
        </Pressable>
      </ScrollView>
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
  saveButton: {
    alignItems: "center",
    paddingVertical: spacing.md + 2,
    borderRadius: radius.xl,
  },
  saveLabel: {
    color: "#0A0A0B",
    fontWeight: "700",
    fontSize: 16,
  },
});
