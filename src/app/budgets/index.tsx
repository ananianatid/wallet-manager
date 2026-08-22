import { Stack, useFocusEffect } from "expo-router";
import { ChevronLeft, ChevronRight, Pencil, Trash } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SelectField } from "@/components/select-field";
import { CategoryIcon } from "@/components/category-icons";
import { EmptyState } from "@/components/empty-state";
import { IconButton, KeyboardAwareScreen, ScreenState } from "@/components/ui";
import {
  deleteLocalBudgetPlan,
  loadBudgetsSnapshot,
  saveLocalBudgetPlan,
} from "@/data/budgets";
import { useCurrency } from "@/currency/context";
import { currencyDigits, parseMoneyInput } from "@/currency/currencies";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, typography, useTheme, type ThemeColors } from "@/theme";
import type { BudgetPeriodSnapshot, BudgetPlan, Category } from "@/types";
import { formatAmount } from "@/utils/format";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return monthKey(date);
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

interface EditRowProps {
  categories: Category[];
  categorySelection: number | null;
  onCategoryChange: (id: number | null) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  rolloverEnabled: boolean;
  onRolloverChange: (enabled: boolean) => void;
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
  rolloverEnabled,
  onRolloverChange,
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
        <View style={[styles.rolloverRow, { borderColor: theme.separator }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.label, fontWeight: "600" }}>Reporter le solde</Text>
            <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
              Le dépassement réduit le mois suivant.
            </Text>
          </View>
          <Switch
            value={rolloverEnabled}
            onValueChange={onRolloverChange}
            accessibilityLabel="Activer le report du budget"
            trackColor={{ false: theme.separator, true: theme.accent }}
          />
        </View>
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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date()));

  const load = useCallback(async () => {
    return loadBudgetsSnapshot(selectedMonth);
  }, [selectedMonth]);

  const resource = useAsyncResource(load, "budgets.load");
  const reload = resource.reload;
  const plans = resource.data?.plans ?? [];
  const expenseCategories = resource.data?.expenseCategories ?? [];
  const snapshots = resource.data?.snapshots ?? [];
  const snapshotByPlan = new Map(snapshots.map((snapshot) => [snapshot.planId, snapshot]));

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const editingBudget =
    editingKey !== null && editingKey !== "new"
      ? plans.find((plan) => String(plan.id) === editingKey) ?? null
      : null;

  const startAdd = () => {
    setEditingKey("new");
    setCategoryId(null);
    setAmount("");
    setRolloverEnabled(false);
  };

  const startEdit = (plan: BudgetPlan) => {
    setEditingKey(String(plan.id));
    setCategoryId(plan.categoryId);
    setAmount((plan.amount / 10 ** currencyDigits(plan.currencyCode)).toString());
    setRolloverEnabled(plan.rolloverEnabled);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setCategoryId(null);
    setAmount("");
    setRolloverEnabled(false);
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
    try {
      await saveLocalBudgetPlan(categoryId, parsed, baseCurrency, rolloverEnabled);
      cancelEdit();
      await resource.reload();
    } catch (e) {
      Alert.alert("Impossible d'enregistrer", userMessage(e));
      log.error("budgets.save", "Échec de l'enregistrement du budget", e);
    }
  };

  const confirmDelete = (plan: BudgetPlan) => {
    Alert.alert("Supprimer ce budget ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await deleteLocalBudgetPlan(plan.id);
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
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.introTitle, { color: theme.label }]}>Plafonds du mois</Text>
          <Text style={[styles.introBody, { color: theme.secondaryLabel }]}>Les dépenses fractionnées sont comptées par allocation et les transferts sont exclus.</Text>
        </View>
        <View style={[styles.monthSelector, { backgroundColor: theme.surface }]}>
          <IconButton
            label="Mois précédent"
            onPress={() => setSelectedMonth((month) => shiftMonth(month, -1))}
            icon={<ChevronLeft size={20} color={theme.label} />}
          />
          <Text accessibilityRole="header" style={[styles.monthLabel, { color: theme.label }]}>
            {monthLabel(selectedMonth)}
          </Text>
          <IconButton
            label="Mois suivant"
            onPress={() => setSelectedMonth((month) => shiftMonth(month, 1))}
            icon={<ChevronRight size={20} color={theme.label} />}
          />
        </View>
        {plans.length === 0 && editingKey === null ? (
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
            borderRadius: radius.xl,
            borderCurve: "continuous",
          }}
        >
          {plans.map((plan, index) => {
            const isEditing = editingKey === String(plan.id);
            const snapshot: BudgetPeriodSnapshot = snapshotByPlan.get(plan.id) ?? {
              planId: plan.id,
              categoryId: plan.categoryId,
              categoryName: plan.categoryName,
              categoryIcon: plan.categoryIcon,
              month: selectedMonth,
              currencyCode: plan.currencyCode,
              plannedAmount: plan.amount,
              rolloverIn: 0,
              spent: 0,
              available: plan.amount,
              rolloverOut: 0,
            };
            const budgetLimit = snapshot.plannedAmount + snapshot.rolloverIn;
            const pct = budgetLimit <= 0 ? 0 : Math.min(Math.max((snapshot.spent / budgetLimit) * 100, 0), 100);
            const over = snapshot.available < 0;
            return (
              <View key={plan.id}>
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
                      plan.categoryId != null ? plan.categoryId : categoryId
                    }
                    onCategoryChange={setCategoryId}
                    amount={amount}
                    onAmountChange={setAmount}
                    onCancel={cancelEdit}
                    onSave={save}
                    rolloverEnabled={rolloverEnabled}
                    onRolloverChange={setRolloverEnabled}
                    theme={theme}
                  />
                ) : (
                  <View style={styles.row}>
                    {plan.categoryIcon ? (
                      <View
                        style={[styles.categoryIcon, { backgroundColor: theme.surfaceElevated }]}
                      >
                        <CategoryIcon name={plan.categoryIcon} size={19} color={theme.accent} />
                      </View>
                    ) : null}
                    <View style={styles.body}>
                      <Text style={[styles.name, { color: theme.label }]}>
                        {plan.categoryName ?? "Toutes les dépenses"}
                      </Text>
                      <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                        Prévu {formatAmount(snapshot.plannedAmount, plan.currencyCode)} · Report {formatAmount(snapshot.rolloverIn, plan.currencyCode)}
                      </Text>
                      <Text style={{ color: over ? theme.expense : theme.secondaryLabel, fontSize: 13 }}>
                        Dépensé {formatAmount(snapshot.spent, plan.currencyCode)} · Restant {formatAmount(snapshot.available, plan.currencyCode)}
                      </Text>
                      <View
                        accessible
                        accessibilityRole="progressbar"
                        accessibilityLabel={`${formatAmount(snapshot.spent, plan.currencyCode)} dépensés sur ${formatAmount(budgetLimit, plan.currencyCode)}`}
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
                      {formatAmount(snapshot.available, plan.currencyCode)}
                    </Text>
                    <IconButton
                      label={`Modifier le budget ${plan.categoryName ?? "global"}`}
                      onPress={() => startEdit(plan)}
                      icon={<Pencil size={18} color={theme.secondaryLabel} strokeWidth={2} />}
                    />
                    <IconButton
                      label={`Supprimer le budget ${plan.categoryName ?? "global"}`}
                      onPress={() => confirmDelete(plan)}
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
                rolloverEnabled={rolloverEnabled}
                onRolloverChange={setRolloverEnabled}
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
    borderRadius: 10,
  },
  intro: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  introTitle: typography.title,
  introBody: typography.body,
  monthSelector: {
    minHeight: 56,
    borderRadius: radius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  monthLabel: {
    textTransform: "capitalize",
    fontWeight: "700",
  },
  rolloverRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    height: 8,
    overflow: "hidden",
    borderRadius: 4,
    marginTop: spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
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
