import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SelectField } from "@/components/select-field";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { deleteSavingsRule, listSavingsRules, setSavingsRule } from "@/db/savings";
import { radius, spacing, useTheme, type ThemeColors } from "@/theme";
import type { Category, SavingsRule } from "@/types";

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : "Une erreur est survenue.";

interface EditRowProps {
  categories: Category[];
  categorySelection: number | null;
  onCategoryChange: (id: number | null) => void;
  percent: string;
  onPercentChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  theme: ThemeColors;
}

function EditRow({
  categories,
  categorySelection,
  onCategoryChange,
  percent,
  onPercentChange,
  onCancel,
  onSave,
  theme,
}: EditRowProps) {
  const options = [
    { id: 0, label: "Tous les revenus" },
    ...categories.map((c) => ({ id: c.id, label: c.name })),
  ];
  return (
    <View style={[styles.row, { flexWrap: "wrap", gap: spacing.sm }]}>
      <View style={{ flex: 1, minWidth: 200 }}>
        <SelectField
          label="Catégorie de revenus"
          value={options.find((o) => o.id === categorySelection)?.label ?? null}
          options={options}
          onChange={(id) => onCategoryChange(id === 0 ? null : id)}
        />
      </View>
      <View style={{ flex: 1, minWidth: 120, gap: spacing.xs + 2 }}>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Pourcentage</Text>
        <TextInput
          value={percent}
          onChangeText={onPercentChange}
          placeholder="10"
          placeholderTextColor={theme.secondaryLabel}
          keyboardType="number-pad"
          inputMode="numeric"
          style={[
            styles.input,
            { backgroundColor: theme.surfaceElevated, color: theme.label },
          ]}
        />
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, width: "100%" }}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.button,
            { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={{ color: theme.secondaryLabel, fontWeight: "600" }}>Annuler</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          style={({ pressed }) => [
            styles.button,
            { flex: 1, backgroundColor: theme.accent },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>Enregistrer</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SavingsScreen() {
  const theme = useTheme();
  const [rules, setRules] = useState<SavingsRule[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [percent, setPercent] = useState("");

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [r, cats] = await Promise.all([
      listSavingsRules(db),
      listCategories(db, "income"),
    ]);
    setRules(r);
    setIncomeCategories(cats);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const startAdd = () => {
    setEditingKey("new");
    setCategoryId(null);
    setPercent("");
  };

  const startEdit = (rule: SavingsRule) => {
    setEditingKey(String(rule.id));
    setCategoryId(rule.categoryId);
    setPercent(String(rule.percent));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setCategoryId(null);
    setPercent("");
  };

  const save = async () => {
    const parsed = Number(percent);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 100) {
      Alert.alert("Pourcentage invalide", "Saisissez un entier entre 1 et 100.");
      return;
    }
    const db = await getDatabase();
    try {
      await setSavingsRule(db, { categoryId, percent: parsed });
      cancelEdit();
      await load();
    } catch (e) {
      Alert.alert("Impossible d'enregistrer", errorMessage(e));
    }
  };

  const confirmDelete = (rule: SavingsRule) => {
    Alert.alert("Supprimer cette règle ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const db = await getDatabase();
          await deleteSavingsRule(db, rule.id);
          await load();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Épargne" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: theme.secondaryLabel, lineHeight: 20 }}>
          Projetez combien vous économisez : un pourcentage de vos revenus par
          catégorie. La cible est calculée en temps réel sur la période des
          statistiques.
        </Text>

        {rules.length === 0 && editingKey === null ? (
          <Text style={{ color: theme.secondaryLabel, textAlign: "center", paddingVertical: spacing.xl }}>
            Aucune règle. Définissez un pourcentage par catégorie de revenus.
          </Text>
        ) : null}

        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.lg,
            borderCurve: "continuous",
          }}
        >
          {rules.map((rule, index) => {
            const isEditing = editingKey === String(rule.id);
            return (
              <View key={rule.id}>
                {index > 0 ? (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: theme.separator,
                      marginLeft: spacing.lg,
                    }}
                  />
                ) : null}
                {isEditing ? (
                  <EditRow
                    categories={incomeCategories}
                    categorySelection={rule.categoryId != null ? rule.categoryId : categoryId}
                    onCategoryChange={setCategoryId}
                    percent={percent}
                    onPercentChange={setPercent}
                    onCancel={cancelEdit}
                    onSave={save}
                    theme={theme}
                  />
                ) : (
                  <View style={styles.row}>
                    <View style={styles.body}>
                      <Text style={[styles.name, { color: theme.label }]}>
                        {rule.categoryName ?? "Tous les revenus"}
                      </Text>
                      <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                        À épargner sur chaque revenu
                      </Text>
                    </View>
                    <Text style={[styles.amount, { color: theme.label }]}>
                      {rule.percent} %
                    </Text>
                    <Pressable onPress={() => startEdit(rule)} hitSlop={8}>
                      <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                        Modifier
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(rule)} hitSlop={8}>
                      <Text style={{ color: theme.expense, fontSize: 13 }}>
                        Supprimer
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}

          {editingKey === "new" ? (
            <View>
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.separator,
                  marginLeft: spacing.lg,
                }}
              />
              <EditRow
                categories={incomeCategories}
                categorySelection={categoryId}
                onCategoryChange={setCategoryId}
                percent={percent}
                onPercentChange={setPercent}
                onCancel={cancelEdit}
                onSave={save}
                theme={theme}
              />
            </View>
          ) : null}
        </View>

        {editingKey === null ? (
          <Pressable
            onPress={startAdd}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: theme.accent, alignSelf: "center", paddingHorizontal: spacing.xl },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>
              + Ajouter une règle
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontWeight: "600",
  },
  amount: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  button: {
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
  addButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
});
