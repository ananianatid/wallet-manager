import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  RotateCcw,
} from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { MonthNavigator } from "@/components/month-navigator";
import { listAccounts } from "@/db/accounts";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import {
  countActiveTransactionFilters,
  resetTransactionFilters,
  setTransactionFilters,
  useTransactionFilters,
  type TransactionFilters,
} from "@/state/transaction-filters";
import { radius, spacing, useTheme } from "@/theme";
import type { Account, Category, TransactionType } from "@/types";
import { formatMonthLabel } from "@/utils/format";

const ALL_TYPES: TransactionType[] = ["income", "expense", "transfer"];
const TYPE_OPTIONS: {
  value: TransactionType;
  label: string;
  icon: typeof ArrowDownLeft;
}[] = [
  { value: "income", label: "Revenus", icon: ArrowDownLeft },
  { value: "expense", label: "Dépenses", icon: ArrowUpRight },
  { value: "transfer", label: "Transferts", icon: ArrowLeftRight },
];

function selectionAfterToggle(
  current: number[] | null,
  id: number,
  allIds: number[],
): number[] | null {
  const selected = new Set(current ?? allIds);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  if (selected.size === 0 || selected.size === allIds.length) return null;
  return allIds.filter((value) => selected.has(value));
}

function isSelected(current: number[] | null, id: number, allIds: number[]): boolean {
  return current == null || current.includes(id) || allIds.length === 0;
}

interface CheckRowProps {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  icon?: typeof ArrowDownLeft;
}

function CheckRow({ label, detail, selected, onPress, icon: Icon }: CheckRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.checkRow,
        { backgroundColor: theme.surface },
        pressed && { opacity: 0.72 },
      ]}
    >
      {Icon ? (
        <View style={[styles.optionIcon, { backgroundColor: theme.surfaceElevated }]}>
          <Icon size={17} strokeWidth={2.2} color={theme.accent} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.label }]}>{label}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: theme.secondaryLabel }]}>{detail}</Text> : null}
      </View>
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: selected ? theme.accent : "transparent",
            borderColor: selected ? theme.accent : theme.separator,
          },
        ]}
      >
        {selected ? <Check size={15} strokeWidth={3} color="#0A0A0B" /> : null}
      </View>
    </Pressable>
  );
}

export default function TransactionFiltersScreen() {
  const theme = useTheme();
  const savedFilters = useTransactionFilters();
  const [draft, setDraft] = useState<TransactionFilters>(savedFilters);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadOptions = useCallback(async () => {
    const db = await getDatabase();
    const [accountRows, categoryRows] = await Promise.all([
      listAccounts(db),
      listCategories(db),
    ]);
    setAccounts(accountRows.filter((account) => !account.hidden));
    setCategories(categoryRows.filter((category) => category.type !== "account"));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOptions().catch(() => {});
    }, [loadOptions]),
  );

  const accountIds = useMemo(() => accounts.map((account) => account.id), [accounts]);
  const categoryIds = useMemo(() => categories.map((category) => category.id), [categories]);
  const activeCount = countActiveTransactionFilters(draft);

  const toggleType = (type: TransactionType) => {
    setDraft((current) => {
      const selected = new Set(current.types);
      if (selected.has(type)) {
        if (selected.size === 1) return current;
        selected.delete(type);
      } else selected.add(type);
      return { ...current, types: ALL_TYPES.filter((value) => selected.has(value)) };
    });
  };

  const apply = () => {
    setTransactionFilters(draft);
    router.back();
  };

  const reset = () => setDraft(resetTransactionFilters());

  const categoryGroups: { type: "income" | "expense"; label: string }[] = [
    { type: "income", label: "Catégories de revenus" },
    { type: "expense", label: "Catégories de dépenses" },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: "Filtres",
          headerRight: () => (
            <Pressable onPress={reset} hitSlop={8} accessibilityLabel="Réinitialiser les filtres">
              <RotateCcw size={19} strokeWidth={2.2} color={theme.accent} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={[styles.intro, { backgroundColor: theme.surfaceElevated }]}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>VUE TRANSACTIONS</Text>
          <Text style={[styles.title, { color: theme.label }]}>Personnalisez votre vue</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>
            Sélectionnez les éléments que vous voulez afficher dans Transactions.
          </Text>
          <View style={[styles.activeBadge, { backgroundColor: theme.surface }]}>
            <Text style={[styles.activeBadgeText, { color: theme.label }]}>
              {activeCount === 0
                ? "Tous les éléments sont affichés"
                : `${activeCount} filtre${activeCount > 1 ? "s" : ""} personnalisé${activeCount > 1 ? "s" : ""}`}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.label }]}>Période</Text>
          <View style={styles.segmentedControl}>
            {([[
              "month",
              "Ce mois",
            ], ["all", "Toutes les périodes"]] as const).map(([value, label]) => {
              const selected = draft.mode === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setDraft((current) => ({ ...current, mode: value }))}
                  style={({ pressed }) => [
                    styles.segment,
                    {
                      backgroundColor: selected ? theme.accent : theme.surface,
                      borderColor: selected ? theme.accent : theme.separator,
                    },
                    pressed && { opacity: 0.72 },
                  ]}
                >
                  <Text style={{ color: selected ? "#0A0A0B" : theme.secondaryLabel, fontWeight: "700" }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {draft.mode === "month" ? (
            <View style={[styles.monthCard, { backgroundColor: theme.surface }]}>
              <MonthNavigator
                year={draft.year}
                month={draft.month}
                onChange={(year, month) => setDraft((current) => ({ ...current, year, month }))}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.label }]}>Types de transactions</Text>
          <View style={styles.rows}>
            {TYPE_OPTIONS.map(({ value, label, icon }) => (
              <CheckRow
                key={value}
                label={label}
                detail={value === "transfer" ? "Déplacements entre comptes" : undefined}
                icon={icon}
                selected={draft.types.includes(value)}
                onPress={() => toggleType(value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.label }]}>Comptes</Text>
          <View style={styles.rows}>
            <CheckRow
              label="Tous les comptes"
              detail="Inclure chaque compte visible"
              selected={draft.accountIds == null}
              onPress={() => setDraft((current) => ({ ...current, accountIds: null }))}
            />
            {accounts.map((account) => (
              <CheckRow
                key={account.id}
                label={account.name}
                detail={account.categoryName}
                selected={isSelected(draft.accountIds, account.id, accountIds)}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    accountIds: selectionAfterToggle(current.accountIds, account.id, accountIds),
                  }))
                }
              />
            ))}
          </View>
        </View>

        {categoryGroups.map((group) => {
          const groupCategories = categories.filter((category) => category.type === group.type);
          if (groupCategories.length === 0) return null;
          return (
            <View key={group.type} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.label }]}>{group.label}</Text>
              <View style={styles.rows}>
                <CheckRow
                  label="Toutes les catégories"
                  selected={draft.categoryIds == null}
                  onPress={() => setDraft((current) => ({ ...current, categoryIds: null }))}
                />
                {groupCategories.map((category) => (
                  <CheckRow
                    key={category.id}
                    label={category.name}
                    selected={isSelected(draft.categoryIds, category.id, categoryIds)}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        categoryIds: selectionAfterToggle(current.categoryIds, category.id, categoryIds),
                      }))
                    }
                  />
                ))}
              </View>
            </View>
          );
        })}

        <View style={[styles.preview, { borderColor: theme.separator }]}>
          <Text style={[styles.previewLabel, { color: theme.secondaryLabel }]}>RÉSUMÉ</Text>
          <Text style={[styles.previewText, { color: theme.label }]}>
            {draft.mode === "month" ? formatMonthLabel(draft.year, draft.month) : "Toutes les périodes"}
            {draft.accountIds == null
              ? " · Tous les comptes"
              : ` · ${draft.accountIds.length} compte${draft.accountIds.length > 1 ? "s" : ""}`}
          </Text>
        </View>

        <Pressable
          onPress={apply}
          style={({ pressed }) => [
            styles.applyButton,
            { backgroundColor: theme.accent },
            pressed && { opacity: 0.78 },
          ]}
        >
          <Text style={styles.applyButtonText}>Appliquer les filtres</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

interface FilterStyles {
  screen: ViewStyle;
  content: ViewStyle;
  intro: ViewStyle;
  eyebrow: TextStyle;
  title: TextStyle;
  subtitle: TextStyle;
  activeBadge: ViewStyle;
  activeBadgeText: TextStyle;
  section: ViewStyle;
  sectionTitle: TextStyle;
  segmentedControl: ViewStyle;
  segment: ViewStyle;
  monthCard: ViewStyle;
  rows: ViewStyle;
  checkRow: ViewStyle;
  optionIcon: ViewStyle;
  rowText: ViewStyle;
  rowLabel: TextStyle;
  rowDetail: TextStyle;
  checkbox: ViewStyle;
  preview: ViewStyle;
  previewLabel: TextStyle;
  previewText: TextStyle;
  applyButton: ViewStyle;
  applyButtonText: TextStyle;
}

const styles = StyleSheet.create<FilterStyles>({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.xl },
  intro: { padding: spacing.xl, borderRadius: radius.xl, gap: spacing.sm, borderCurve: "continuous" },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { fontSize: 27, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  activeBadge: { alignSelf: "flex-start", marginTop: spacing.sm, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  activeBadgeText: { fontSize: 13, fontWeight: "700" },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: 19, fontWeight: "800", letterSpacing: -0.2 },
  segmentedControl: { flexDirection: "row", gap: spacing.sm },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  monthCard: { paddingVertical: spacing.sm, borderRadius: radius.lg },
  rows: { gap: StyleSheet.hairlineWidth },
  checkRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, borderCurve: "continuous" },
  optionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16, fontWeight: "600" },
  rowDetail: { fontSize: 12 },
  checkbox: { width: 24, height: 24, borderWidth: 1.5, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  preview: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.lg, gap: spacing.xs },
  previewLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  previewText: { fontSize: 15, fontWeight: "600" },
  applyButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: radius.lg, borderCurve: "continuous" },
  applyButtonText: { color: "#0A0A0B", fontSize: 16, fontWeight: "800" },
});
