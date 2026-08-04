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
import { deleteBudget, listBudgets, setBudget } from "@/db/budgets";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { radius, spacing, useTheme, type ThemeColors } from "@/theme";
import type { Budget, Category } from "@/types";
import { formatAmount } from "@/utils/format";

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : "Une erreur est survenue.";

interface EditRowProps {
  categories: Category[];
  categorySelection: number | null;
  onCategoryChange: (id: number | null) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  theme: ThemeColors;
}

function EditRow({
  categories,
  categorySelection,
  onCategoryChange,
  amount,
  onAmountChange,
  onCancel,
  onSave,
  theme,
}: EditRowProps) {
  const options = [
    { id: 0, label: "Toutes les dépenses" },
    ...categories.map((c) => ({ id: c.id, label: c.name })),
  ];
  return (
    <View style={[styles.row, { flexWrap: "wrap", gap: spacing.sm }]}>
      <View style={{ flex: 1, minWidth: 200 }}>
        <SelectField
          label="Catégorie"
          value={options.find((o) => o.id === categorySelection)?.label ?? null}
          options={options}
          onChange={(id) => onCategoryChange(id === 0 ? null : id)}
        />
      </View>
      <View style={{ flex: 1, minWidth: 120, gap: spacing.xs + 2 }}>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Montant / mois</Text>
        <TextInput
          value={amount}
          onChangeText={onAmountChange}
          placeholder="0"
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

export default function BudgetsScreen() {
  const theme = useTheme();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [b, cats] = await Promise.all([
      listBudgets(db),
      listCategories(db, "expense"),
    ]);
    setBudgets(b);
    setExpenseCategories(cats);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const editingBudget =
    editingKey !== null && editingKey !== "new"
      ? budgets.find((b) => String(b.id) === editingKey) ?? null
      : null;

  const startAdd = () => {
    setEditingKey("new");
    setCategoryId(null);
    setAmount("");
  };

  const startEdit = (budget: Budget) => {
    setEditingKey(String(budget.id));
    setCategoryId(budget.categoryId);
    setAmount(String(budget.amount));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setCategoryId(null);
    setAmount("");
  };

  const save = async () => {
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      Alert.alert("Montant invalide", "Saisissez un budget entier positif en FCFA.");
      return;
    }
    if (categoryId == null && editingBudget && editingBudget.categoryId != null) {
      Alert.alert("Choix invalide", "Sélectionnez la catégorie du budget.");
      return;
    }
    const db = await getDatabase();
    try {
      await setBudget(db, categoryId, parsed);
      cancelEdit();
      await load();
    } catch (e) {
      Alert.alert("Impossible d'enregistrer", errorMessage(e));
    }
  };

  const confirmDelete = (budget: Budget) => {
    Alert.alert("Supprimer ce budget ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const db = await getDatabase();
          await deleteBudget(db, budget.id);
          await load();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Budgets" }} />
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
        {budgets.length === 0 && editingKey === null ? (
          <Text style={{ color: theme.secondaryLabel, textAlign: "center", paddingVertical: spacing.xl }}>
            Aucun budget. Définissez un montant mensuel par catégorie de dépenses.
          </Text>
        ) : null}

        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.lg,
            borderCurve: "continuous",
          }}
        >
          {budgets.map((budget, index) => {
            const isEditing = editingKey === String(budget.id);
            return (
              <View key={budget.id}>
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
                    categories={expenseCategories}
                    categorySelection={
                      budget.categoryId != null ? budget.categoryId : categoryId
                    }
                    onCategoryChange={setCategoryId}
                    amount={amount}
                    onAmountChange={setAmount}
                    onCancel={cancelEdit}
                    onSave={save}
                    theme={theme}
                  />
                ) : (
                  <View style={styles.row}>
                    <View style={styles.body}>
                      <Text style={[styles.name, { color: theme.label }]}>
                        {budget.categoryName ?? "Toutes les dépenses"}
                      </Text>
                      <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                        Par mois
                      </Text>
                    </View>
                    <Text style={[styles.amount, { color: theme.label }]}>
                      {formatAmount(budget.amount)}
                    </Text>
                    <Pressable onPress={() => startEdit(budget)} hitSlop={8}>
                      <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                        Modifier
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(budget)} hitSlop={8}>
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
                categories={expenseCategories}
                categorySelection={categoryId}
                onCategoryChange={setCategoryId}
                amount={amount}
                onAmountChange={setAmount}
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
              + Ajouter un budget
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