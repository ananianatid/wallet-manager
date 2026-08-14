import { Stack, useFocusEffect } from "expo-router";
import { Pencil, Trash } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SelectField } from "@/components/select-field";
import { CategoryIcon } from "@/components/category-icons";
import { EmptyState } from "@/components/empty-state";
import { IconButton, KeyboardAwareScreen, ScreenState } from "@/components/ui";
import { deleteBudget, listBudgets, setBudget } from "@/db/budgets";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { useCurrency, useCurrencyConverter } from "@/currency/context";
import { currencyDigits, parseMoneyInput } from "@/currency/currencies";
import { listTransactions } from "@/db/transactions";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme, type ThemeColors } from "@/theme";
import type { Budget, Category } from "@/types";
import { formatAmount } from "@/utils/format";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

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
    ...categories.map((c) => ({ id: c.id, label: c.name, icon: c.icon })),
  ];
  return (
    <View style={[styles.row, { flexWrap: "wrap", gap: spacing.sm }]}>
      <View style={{ flex: 1, minWidth: 200 }}>
        <SelectField
          label="Catégorie"
          value={options.find((o) => o.id === categorySelection)?.label ?? null}
          options={options}
          layout="grid"
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
          maxLength={12}
          accessibilityLabel="Montant du budget par mois en FCFA"
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
          <Text style={{ color: theme.onAccent, fontWeight: "700" }}>Enregistrer</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function BudgetsScreen() {
  const theme = useTheme();
  const { baseCurrency } = useCurrency();
  const convert = useCurrencyConverter();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    const db = await getDatabase();
    const now = new Date();
    const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endMs = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const [b, cats, tx] = await Promise.all([
      listBudgets(db),
      listCategories(db, "expense"),
      listTransactions(db, { startMs, endMs }),
    ]);
    const spentByCategory = new Map<number, number>();
    let totalExpense = 0;
    for (const t of tx) {
      if (t.type !== "expense") {
        continue;
      }
      totalExpense += convert(t.amount, t.accountCurrencyCode ?? baseCurrency) ?? 0;
      if (t.categoryId != null) {
        spentByCategory.set(
          t.categoryId,
          (spentByCategory.get(t.categoryId) ?? 0) + (convert(t.amount, t.accountCurrencyCode ?? baseCurrency) ?? 0),
        );
      }
    }
    return { budgets: b, expenseCategories: cats, spentByCategory, totalExpense };
  }, [baseCurrency, convert]);

  const resource = useAsyncResource(load, "budgets.load");
  const reload = resource.reload;
  const budgets = resource.data?.budgets ?? [];
  const expenseCategories = resource.data?.expenseCategories ?? [];
  const spentByCategory = resource.data?.spentByCategory ?? new Map<number, number>();
  const totalExpense = resource.data?.totalExpense ?? 0;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
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
    setAmount((budget.amount / 10 ** currencyDigits(budget.currencyCode)).toString());
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setCategoryId(null);
    setAmount("");
  };

  const save = async () => {
    const parsed = parseMoneyInput(amount, baseCurrency);
    if (parsed == null || Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert("Montant invalide", `Saisissez un budget positif en ${baseCurrency}.`);
      return;
    }
    if (categoryId == null && editingBudget && editingBudget.categoryId != null) {
      Alert.alert("Choix invalide", "Sélectionnez la catégorie du budget.");
      return;
    }
    const db = await getDatabase();
    try {
      await setBudget(db, categoryId, parsed, baseCurrency);
      cancelEdit();
      await resource.reload();
    } catch (e) {
      Alert.alert("Impossible d'enregistrer", userMessage(e));
      log.error("budgets.save", "Échec de l'enregistrement du budget", e);
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
          await resource.reload();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Budgets" }} />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={userMessage(resource.error)}
          onRetry={() => void resource.reload()}
        />
      ) : (
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
      >
        {budgets.length === 0 && editingKey === null ? (
          <EmptyState
            title="Aucun budget"
            message="Définissez un montant mensuel par catégorie de dépenses."
            actionLabel="Ajouter un budget"
            onAction={startAdd}
          />
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
            const spent =
              budget.categoryId == null
                ? totalExpense
                : (spentByCategory.get(budget.categoryId) ?? 0);
            const pct = Math.min((spent / budget.amount) * 100, 100);
            const over = spent > budget.amount;
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
                    {budget.categoryIcon ? (
                      <View style={[styles.categoryIcon, { backgroundColor: theme.surfaceElevated }]}>
                        <CategoryIcon name={budget.categoryIcon} size={19} color={theme.accent} />
                      </View>
                    ) : null}
                    <View style={styles.body}>
                      <Text style={[styles.name, { color: theme.label }]}>
                        {budget.categoryName ?? "Toutes les dépenses"}
                      </Text>
                      <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                        {formatAmount(spent, baseCurrency)} / {formatAmount(budget.amount, budget.currencyCode)} ce mois
                      </Text>
                      <View
                        accessible
                        accessibilityRole="progressbar"
                        accessibilityLabel={`${formatAmount(spent, baseCurrency)} dépensés sur ${formatAmount(budget.amount, budget.currencyCode)}`}
                        style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: over ? theme.expense : theme.accent,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={[styles.amount, { color: theme.label }]}>
                      {formatAmount(budget.amount, budget.currencyCode)}
                    </Text>
                    <IconButton
                      label={`Modifier le budget ${budget.categoryName ?? "global"}`}
                      onPress={() => startEdit(budget)}
                      icon={<Pencil size={18} color={theme.secondaryLabel} strokeWidth={2} />}
                    />
                    <IconButton
                      label={`Supprimer le budget ${budget.categoryName ?? "global"}`}
                      onPress={() => confirmDelete(budget)}
                      icon={<Trash size={18} color={theme.expense} strokeWidth={2} />}
                    />
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
            <Text style={{ color: theme.onAccent, fontWeight: "700" }}>
              + Ajouter un budget
            </Text>
          </Pressable>
        ) : null}
      </KeyboardAwareScreen>
      )}
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
  categoryIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
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
  progressTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 3,
    marginTop: spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  button: {
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
  addButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
});
