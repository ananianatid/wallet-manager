import DateTimePicker from "@react-native-community/datetimepicker";
import { router, Stack, useFocusEffect } from "expo-router";
import { ChevronRight, Pencil, PiggyBank, Trash } from "lucide-react-native";
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
import { IconButton, KeyboardAwareScreen, ScreenState } from "@/components/ui";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { useAsyncResource } from "@/hooks/use-async-resource";
import {
  deleteSavingsRule,
  getFirstIncomeDate,
  listSavingsRules,
  setSavingsRule,
} from "@/db/savings";
import { radius, spacing, useTheme, withAlpha, type ThemeColors } from "@/theme";
import type { Category, SavingsRule } from "@/types";
import { formatDate } from "@/utils/format";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

interface EditRowProps {
  categories: Category[];
  categorySelection: number | null;
  onCategoryChange: (id: number | null) => void;
  percent: string;
  onPercentChange: (value: string) => void;
  startDate: number | null;
  subtractFromAvailable: boolean;
  onSubtractFromAvailableChange: (value: boolean) => void;
  onStartDateChange: (value: number | null) => void;
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
  startDate,
  onStartDateChange,
  subtractFromAvailable,
  onSubtractFromAvailableChange,
  onCancel,
  onSave,
  theme,
}: EditRowProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const options = [
    { id: 0, label: "Tous les revenus" },
    ...categories.map((c) => ({ id: c.id, label: c.name, icon: c.icon })),
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
          maxLength={3}
          accessibilityLabel="Pourcentage de revenus à épargner"
          style={[
            styles.input,
            { backgroundColor: theme.surfaceElevated, color: theme.label },
          ]}
        />
      </View>

      <View style={{ width: "100%", gap: spacing.xs + 2 }}>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
          Date de départ
        </Text>
        <View style={styles.dateRow}>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Date de départ ${startDate ? formatDate(startDate) : "depuis le début"}`}
            style={({ pressed }) => [
              styles.dateButton,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.separator },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: startDate ? theme.label : theme.secondaryLabel, fontWeight: "600" }}>
              {startDate ? `Depuis le ${formatDate(startDate)}` : "Depuis le début"}
            </Text>
          </Pressable>
          {startDate != null ? (
            <Pressable
              onPress={() => onStartDateChange(null)}
              hitSlop={8}
              accessibilityLabel="Effacer la date de départ"
              style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: theme.expense, fontSize: 13 }}>Effacer</Text>
            </Pressable>
          ) : null}
        </View>
        {showDatePicker ? (
          <DateTimePicker
            mode="date"
            value={startDate ? new Date(startDate) : new Date()}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) onStartDateChange(date.getTime());
            }}
            onDismiss={() => setShowDatePicker(false)}
          />
        ) : null}
      </View>

      <View style={styles.ruleToggle}>
        <View style={styles.switchBody}>
          <Text style={{ color: theme.label, fontWeight: "600" }}>
            Retirer du disponible estimé
          </Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 17 }}>
            Désactivé : règle informative uniquement.
          </Text>
        </View>
        <Switch
          value={subtractFromAvailable}
          onValueChange={onSubtractFromAvailableChange}
          trackColor={{ true: theme.accent }}
          thumbColor={theme.accentSurfaceText}
          accessibilityLabel="Retirer cette règle du disponible estimé"
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

export default function SavingsScreen() {
  const theme = useTheme();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [percent, setPercent] = useState("");
  const [startDate, setStartDate] = useState<number | null>(null);
  const [subtractFromAvailable, setSubtractFromAvailable] = useState(false);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [r, cats, firstIncome] = await Promise.all([
      listSavingsRules(db),
      listCategories(db, "income"),
      getFirstIncomeDate(db),
    ]);
    return { rules: r, incomeCategories: cats, firstIncomeDate: firstIncome };
  }, []);

  const resource = useAsyncResource(load, "savings.load");
  const reload = resource.reload;
  const rules = resource.data?.rules ?? [];
  const incomeCategories = resource.data?.incomeCategories ?? [];
  const firstIncomeDate = resource.data?.firstIncomeDate ?? null;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const startAdd = () => {
    setEditingKey("new");
    setCategoryId(null);
    setPercent("");
    setStartDate(firstIncomeDate);
    setSubtractFromAvailable(false);
  };

  const startEdit = (rule: SavingsRule) => {
    setEditingKey(String(rule.id));
    setCategoryId(rule.categoryId);
    setPercent(String(rule.percent));
    setStartDate(rule.startDate);
    setSubtractFromAvailable(rule.subtractFromAvailable);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setCategoryId(null);
    setPercent("");
    setStartDate(null);
    setSubtractFromAvailable(false);
  };

  const save = async () => {
    const parsed = Number(percent);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 100) {
      Alert.alert("Pourcentage invalide", "Saisissez un entier entre 1 et 100.");
      return;
    }
    const db = await getDatabase();
    try {
      await setSavingsRule(db, {
        categoryId,
        percent: parsed,
        startDate,
        subtractFromAvailable,
      });
      cancelEdit();
      await resource.reload();
    } catch (e) {
      Alert.alert("Impossible d'enregistrer", userMessage(e));
      log.error("savings.save", "Échec de l'enregistrement de la règle d'épargne", e);
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
          await resource.reload();
        },
      },
    ]);
  };

  const toggleRuleSubtract = async (rule: SavingsRule, next: boolean) => {
    try {
      const db = await getDatabase();
      await setSavingsRule(db, {
        categoryId: rule.categoryId,
        percent: rule.percent,
        startDate: rule.startDate,
        subtractFromAvailable: next,
      });
      await resource.reload();
    } catch (e) {
      log.error("savings.toggle", "Échec de la mise à jour de la règle d'épargne", e);
      Alert.alert("Impossible d'enregistrer", "Le réglage de cette règle n'a pas pu être mis à jour.");
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Épargne" }} />
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
        <Text style={{ color: theme.secondaryLabel, lineHeight: 20 }}>
          Projetez combien vous économisez : un pourcentage de vos revenus par
          catégorie. La cible est calculée en temps réel depuis la date de
          départ de chaque règle.
        </Text>

        <Pressable
          onPress={() => router.push("/savings/history")}
          accessibilityRole="button"
          accessibilityLabel="Voir le suivi mensuel de l’épargne"
          style={({ pressed }) => [
            styles.historyButton,
            { backgroundColor: withAlpha(theme.accentSurface, "12") },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={[styles.switchIcon, { backgroundColor: theme.surfaceElevated }]}>
            <PiggyBank size={18} color={theme.accent} />
          </View>
          <View style={styles.switchBody}>
            <Text style={{ color: theme.label, fontWeight: "600" }}>
              Suivi mensuel de l’épargne
            </Text>
            <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 17 }}>
              Consultez les prélèvements estimés mois par mois.
            </Text>
          </View>
          <ChevronRight size={20} color={theme.secondaryLabel} />
        </Pressable>

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
                    startDate={startDate}
                    onStartDateChange={setStartDate}
                    subtractFromAvailable={subtractFromAvailable}
                    onSubtractFromAvailableChange={setSubtractFromAvailable}
                    onCancel={cancelEdit}
                    onSave={save}
                    theme={theme}
                  />
                ) : (
                  <View
                    style={[
                      styles.row,
                      rule.subtractFromAvailable && {
                        backgroundColor: withAlpha(theme.accentSurface, "0C"),
                      },
                    ]}
                  >
                    {rule.categoryIcon ? (
                      <View style={[styles.categoryIcon, { backgroundColor: theme.surfaceElevated }]}>
                        <CategoryIcon name={rule.categoryIcon} size={19} color={theme.accent} />
                      </View>
                    ) : null}
                    <View style={styles.body}>
                      <Text style={[styles.name, { color: theme.label }]}>
                        {rule.categoryName ?? "Tous les revenus"}
                      </Text>
                      <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                        À épargner sur chaque revenu
                        {rule.startDate != null ? ` depuis le ${formatDate(rule.startDate)}` : ""}
                      </Text>
                      <Text style={{ color: rule.subtractFromAvailable ? theme.accent : theme.secondaryLabel, fontSize: 12, fontWeight: "600" }}>
                        {rule.subtractFromAvailable ? "Retirée du disponible" : "Informatif uniquement"}
                      </Text>
                    </View>
                    <Text selectable style={[styles.amount, { color: theme.label }]}>
                      {rule.percent} %
                    </Text>
                    <Switch
                      value={rule.subtractFromAvailable}
                      onValueChange={(next) => void toggleRuleSubtract(rule, next)}
                      trackColor={{ true: theme.accent }}
                      thumbColor={theme.accentSurfaceText}
                      accessibilityLabel={`Retirer la règle ${rule.categoryName ?? "globale"} du disponible estimé`}
                    />
                    <IconButton
                      label={`Modifier la règle ${rule.categoryName ?? "globale"}`}
                      onPress={() => startEdit(rule)}
                      icon={<Pencil size={18} color={theme.secondaryLabel} strokeWidth={2} />}
                    />
                    <IconButton
                      label={`Supprimer la règle ${rule.categoryName ?? "globale"}`}
                      onPress={() => confirmDelete(rule)}
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
                categories={incomeCategories}
                categorySelection={categoryId}
                onCategoryChange={setCategoryId}
                percent={percent}
                onPercentChange={setPercent}
                startDate={startDate}
                onStartDateChange={setStartDate}
                subtractFromAvailable={subtractFromAvailable}
                onSubtractFromAvailableChange={setSubtractFromAvailable}
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
              + Ajouter une règle
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
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  ruleToggle: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  switchIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  switchBody: {
    flex: 1,
    gap: 2,
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
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dateButton: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  clearButton: {
    minHeight: 48,
    justifyContent: "center",
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
