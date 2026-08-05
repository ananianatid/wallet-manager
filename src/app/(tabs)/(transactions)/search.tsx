import DateTimePicker from "@react-native-community/datetimepicker";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Search,
} from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CategoryIcon } from "@/components/category-icons";
import { EmptyState } from "@/components/empty-state";
import { TransactionRow } from "@/components/transaction-row";
import {
  ActionButton,
  FormField,
  IconButton,
  InlineError,
  ScreenState,
} from "@/components/ui";
import { listAccounts } from "@/db/accounts";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { searchTransactions } from "@/db/transactions";
import { useAsyncResource } from "@/hooks/use-async-resource";
import {
  resetTransactionSearch,
  setTransactionSearch,
  useTransactionSearch,
} from "@/state/transaction-search";
import { radius, spacing, useTheme } from "@/theme";
import type {
  Account,
  Category,
  Transaction,
  TransactionSearchCriteria,
  TransactionType,
} from "@/types";
import { formatAmount, formatDate, formatDayLabel } from "@/utils/format";

const TYPE_OPTIONS: {
  value: TransactionType;
  label: string;
  icon: typeof ArrowDownLeft;
}[] = [
  { value: "income", label: "Revenus", icon: ArrowDownLeft },
  { value: "expense", label: "Dépenses", icon: ArrowUpRight },
  { value: "transfer", label: "Transferts", icon: ArrowLeftRight },
];

interface SearchSection {
  key: string;
  title: string;
  total: number;
  data: Transaction[];
}

interface SearchOptions {
  accounts: Account[];
  categories: Category[];
}

function startOfLocalDay(value: number): number {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function parseAmount(value: string): number | null {
  const compact = value.replace(/\s/g, "").trim();
  if (!compact || !/^\d+$/.test(compact)) {
    return null;
  }
  const amount = Number(compact);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function amountInput(value: number | null): string {
  return value == null ? "" : String(value);
}

function toggleId(
  current: number[] | null,
  id: number,
  allIds: number[],
): number[] | null {
  const selected = new Set(current ?? allIds);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  if (selected.size === allIds.length) return null;
  return allIds.filter((value) => selected.has(value));
}

function isSelected(
  current: number[] | null,
  id: number,
): boolean {
  return current == null || current.includes(id);
}

interface ChoiceRowProps {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  icon?: typeof ArrowDownLeft;
  categoryIcon?: string | null;
}

function ChoiceRow({
  label,
  detail,
  selected,
  onPress,
  icon: Icon,
  categoryIcon,
}: ChoiceRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.choiceRow,
        { backgroundColor: theme.surface },
        pressed && { opacity: 0.72 },
      ]}
    >
      {Icon ? (
        <View style={[styles.choiceIcon, { backgroundColor: theme.surfaceElevated }]}>
          <Icon size={17} strokeWidth={2.2} color={theme.accent} />
        </View>
      ) : categoryIcon ? (
        <View style={[styles.choiceIcon, { backgroundColor: theme.surfaceElevated }]}>
          <CategoryIcon name={categoryIcon} size={17} strokeWidth={2.2} color={theme.accent} />
        </View>
      ) : null}
      <View style={styles.choiceText}>
        <Text style={[styles.choiceLabel, { color: theme.label }]}>{label}</Text>
        {detail ? (
          <Text style={[styles.choiceDetail, { color: theme.secondaryLabel }]}>
            {detail}
          </Text>
        ) : null}
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
        {selected ? <Check size={15} strokeWidth={3} color={theme.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

export default function TransactionSearchScreen() {
  const theme = useTheme();
  const criteria = useTransactionSearch();
  const [minInput, setMinInput] = useState(amountInput(criteria.minAmount));
  const [maxInput, setMaxInput] = useState(amountInput(criteria.maxAmount));
  const [datePicker, setDatePicker] = useState<"start" | "end" | null>(null);
  const [expanded, setExpanded] = useState<{
    accounts: boolean;
    categories: boolean;
  }>({ accounts: false, categories: false });
  const [results, setResults] = useState<Transaction[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pickerFallback] = useState(() => Date.now());

  const loadOptions = useCallback(async (): Promise<SearchOptions> => {
    const db = await getDatabase();
    const [accounts, categories] = await Promise.all([
      listAccounts(db),
      listCategories(db),
    ]);
    return {
      accounts: accounts.filter((account) => !account.hidden),
      categories: categories.filter((category) => category.type !== "account"),
    };
  }, []);

  const optionsResource = useAsyncResource(loadOptions);
  const reloadOptions = optionsResource.reload;
  const accounts = useMemo(
    () => optionsResource.data?.accounts ?? [],
    [optionsResource.data?.accounts],
  );
  const categories = useMemo(
    () => optionsResource.data?.categories ?? [],
    [optionsResource.data?.categories],
  );
  const accountIds = useMemo(() => accounts.map((account) => account.id), [accounts]);
  const categoryIds = useMemo(() => categories.map((category) => category.id), [categories]);

  useFocusEffect(
    useCallback(() => {
      void reloadOptions();
    }, [reloadOptions]),
  );

  const validationError = useMemo(() => {
    const min = minInput.trim() ? parseAmount(minInput) : null;
    const max = maxInput.trim() ? parseAmount(maxInput) : null;
    if (minInput.trim() && min == null) {
      return "Le montant minimum doit être un entier positif.";
    }
    if (maxInput.trim() && max == null) {
      return "Le montant maximum doit être un entier positif.";
    }
    if (min != null && max != null && min > max) {
      return "Le montant minimum doit être inférieur ou égal au maximum.";
    }
    if (
      criteria.startDate != null &&
      criteria.endDate != null &&
      criteria.startDate > criteria.endDate
    ) {
      return "La date de début doit précéder la date de fin.";
    }
    return null;
  }, [criteria.endDate, criteria.startDate, maxInput, minInput]);

  useEffect(() => {
    if (validationError) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setStatus("loading");
      setError(null);
      getDatabase()
        .then((db) => searchTransactions(db, criteria))
        .then((rows) => {
          if (!cancelled) {
            setResults(rows);
            setStatus("ready");
          }
        })
        .catch((reason: unknown) => {
          if (!cancelled) {
            setResults(null);
            setStatus("error");
            setError(
              reason instanceof Error
                ? reason.message
                : "La recherche n'a pas pu aboutir.",
            );
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [criteria, validationError]);

  const sections = useMemo<SearchSection[]>(() => {
    const groups = new Map<string, SearchSection>();
    for (const transaction of validationError ? [] : results ?? []) {
      const date = new Date(transaction.transactionDate);
      const key = date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
      let section = groups.get(key);
      if (!section) {
        section = {
          key,
          title: formatDayLabel(transaction.transactionDate),
          total: 0,
          data: [],
        };
        groups.set(key, section);
      }
      section.data.push(transaction);
      section.total +=
        transaction.type === "income"
          ? transaction.amount
          : transaction.type === "expense"
            ? -transaction.amount
            : transaction.fee
              ? -transaction.fee
              : 0;
    }
    return [...groups.values()];
  }, [results, validationError]);

  const update = (patch: Partial<TransactionSearchCriteria>) => {
    setTransactionSearch({ ...criteria, ...patch });
  };

  const updateAmount = (
    field: "minAmount" | "maxAmount",
    value: string,
    setInput: (value: string) => void,
  ) => {
    setInput(value);
    const parsed = value.trim() ? parseAmount(value) : null;
    if (!value.trim() || parsed != null) {
      update({ [field]: parsed });
    }
  };

  const selectDate = (kind: "start" | "end", value: Date) => {
    const selected = startOfLocalDay(value.getTime());
    update({ [kind === "start" ? "startDate" : "endDate"]: selected });
    setDatePicker(null);
  };

  const reset = () => {
    const next = resetTransactionSearch();
    setMinInput(amountInput(next.minAmount));
    setMaxInput(amountInput(next.maxAmount));
    setDatePicker(null);
    setError(null);
  };

  const toggleType = (type: TransactionType) => {
    const types = criteria.types.includes(type)
      ? criteria.types.filter((value) => value !== type)
      : [...criteria.types, type];
    update({ types });
  };

  const openEdit = (id: number) =>
    router.push({ pathname: "/new-transaction", params: { id: String(id) } });

  const renderForm = (
    <View style={styles.form}>
      <View style={[styles.hero, { backgroundColor: theme.surfaceElevated }]}>
        <View style={styles.heroTitleRow}>
          <View style={[styles.heroIcon, { backgroundColor: theme.accent }]}>
            <Search size={20} strokeWidth={2.5} color={theme.onAccent} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: theme.accent }]}>EXPLORER</Text>
            <Text style={[styles.title, { color: theme.label }]}>Retrouver une transaction</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>
          Combinez plusieurs critères pour retrouver rapidement un mouvement précis.
        </Text>
      </View>

      <View style={styles.section}>
        <FormField
          label="Recherche"
          hint="Note, catégorie, compte ou montant"
        >
          <View style={[styles.searchInputWrap, { backgroundColor: theme.surface }]}>
            <Search size={18} strokeWidth={2.2} color={theme.secondaryLabel} />
            <TextInput
              value={criteria.query}
              onChangeText={(query) => update({ query })}
              placeholder="Ex. salaire, Flooz, 50000…"
              placeholderTextColor={theme.secondaryLabel}
              accessibilityLabel="Recherche de transaction"
              style={[styles.searchInput, { color: theme.label }]}
              returnKeyType="search"
            />
          </View>
        </FormField>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.label }]}>Période</Text>
        <View style={styles.dateRow}>
          {(["start", "end"] as const).map((kind) => {
            const value = kind === "start" ? criteria.startDate : criteria.endDate;
            return (
              <Pressable
                key={kind}
                onPress={() => setDatePicker(kind)}
                accessibilityRole="button"
                accessibilityLabel={
                  kind === "start" ? "Choisir la date de début" : "Choisir la date de fin"
                }
                style={({ pressed }) => [
                  styles.dateButton,
                  { backgroundColor: theme.surface, borderColor: theme.separator },
                  pressed && { opacity: 0.72 },
                ]}
              >
                <CalendarDays size={17} color={theme.accent} />
                <View style={styles.dateCopy}>
                  <Text style={[styles.dateLabel, { color: theme.secondaryLabel }]}>
                    {kind === "start" ? "À partir du" : "Jusqu'au"}
                  </Text>
                  <Text style={[styles.dateValue, { color: value == null ? theme.secondaryLabel : theme.label }]}>
                    {value == null ? "Toutes les dates" : formatDate(value)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {criteria.startDate != null || criteria.endDate != null ? (
          <Pressable
            onPress={() => update({ startDate: null, endDate: null })}
            accessibilityRole="button"
            accessibilityLabel="Effacer la période"
          >
            <Text style={[styles.clearLink, { color: theme.accent }]}>Effacer la période</Text>
          </Pressable>
        ) : null}
        {datePicker ? (
          <DateTimePicker
            value={new Date(
              datePicker === "start"
                ? criteria.startDate ?? pickerFallback
                : criteria.endDate ?? criteria.startDate ?? pickerFallback,
            )}
            mode="date"
            onChange={(_, value) => {
              if (value) selectDate(datePicker, value);
              else setDatePicker(null);
            }}
            onDismiss={() => setDatePicker(null)}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.label }]}>Montant</Text>
        <View style={styles.amountRow}>
          <FormField label="Minimum">
            <TextInput
              value={minInput}
              onChangeText={(value) => updateAmount("minAmount", value, setMinInput)}
              placeholder="0"
              placeholderTextColor={theme.secondaryLabel}
              keyboardType="number-pad"
              accessibilityLabel="Montant minimum"
              style={[styles.amountInput, { backgroundColor: theme.surface, color: theme.label }]}
            />
          </FormField>
          <FormField label="Maximum">
            <TextInput
              value={maxInput}
              onChangeText={(value) => updateAmount("maxAmount", value, setMaxInput)}
              placeholder="Illimité"
              placeholderTextColor={theme.secondaryLabel}
              keyboardType="number-pad"
              accessibilityLabel="Montant maximum"
              style={[styles.amountInput, { backgroundColor: theme.surface, color: theme.label }]}
            />
          </FormField>
        </View>
        {validationError ? (
          <Text style={[styles.error, { color: theme.expense }]} accessibilityRole="alert">
            {validationError}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.label }]}>Types</Text>
        <View style={styles.choiceGroup}>
          {TYPE_OPTIONS.map(({ value, label, icon }) => (
            <ChoiceRow
              key={value}
              label={label}
              icon={icon}
              selected={criteria.types.includes(value)}
              onPress={() => toggleType(value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={() => setExpanded((current) => ({ ...current, accounts: !current.accounts }))}
          accessibilityRole="button"
          accessibilityLabel={`${expanded.accounts ? "Replier" : "Déplier"} la liste des comptes`}
          style={({ pressed }) => [
            styles.toggleRow,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.label }]}>Comptes</Text>
          <View style={styles.toggleMeta}>
            {criteria.accountIds != null ? (
              <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "700" }}>
                {criteria.accountIds.length} sélectionné{criteria.accountIds.length > 1 ? "s" : ""}
              </Text>
            ) : null}
            {expanded.accounts ? (
              <ChevronDown size={18} color={theme.secondaryLabel} strokeWidth={2} />
            ) : (
              <ChevronRight size={18} color={theme.secondaryLabel} strokeWidth={2} />
            )}
          </View>
        </Pressable>
        {expanded.accounts ? (
          <View style={styles.choiceGroup}>
            <ChoiceRow
              label="Tous les comptes"
              detail="Inclure chaque compte visible"
              selected={criteria.accountIds == null}
              onPress={() => update({ accountIds: null })}
            />
            {accounts.map((account) => (
              <ChoiceRow
                key={account.id}
                label={account.name}
                detail={account.groupName ?? undefined}
                selected={isSelected(criteria.accountIds, account.id)}
                onPress={() => update({ accountIds: toggleId(criteria.accountIds, account.id, accountIds) })}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Pressable
          onPress={() => setExpanded((current) => ({ ...current, categories: !current.categories }))}
          accessibilityRole="button"
          accessibilityLabel={`${expanded.categories ? "Replier" : "Déplier"} la liste des catégories`}
          style={({ pressed }) => [
            styles.toggleRow,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.label }]}>Catégories</Text>
          <View style={styles.toggleMeta}>
            {criteria.categoryIds != null ? (
              <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "700" }}>
                {criteria.categoryIds.length} sélectionné{criteria.categoryIds.length > 1 ? "s" : ""}
              </Text>
            ) : null}
            {expanded.categories ? (
              <ChevronDown size={18} color={theme.secondaryLabel} strokeWidth={2} />
            ) : (
              <ChevronRight size={18} color={theme.secondaryLabel} strokeWidth={2} />
            )}
          </View>
        </Pressable>
        {expanded.categories ? (
          <View style={styles.choiceGroup}>
            <ChoiceRow
              label="Toutes les catégories"
              detail="Revenus et dépenses"
              selected={criteria.categoryIds == null}
              onPress={() => update({ categoryIds: null })}
            />
            {categories.map((category) => (
              <ChoiceRow
                key={category.id}
                label={category.name}
                detail={category.type === "income" ? "Revenu" : "Dépense"}
                categoryIcon={category.icon}
                selected={isSelected(criteria.categoryIds, category.id)}
                onPress={() => update({ categoryIds: toggleId(criteria.categoryIds, category.id, categoryIds) })}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <ActionButton label="Réinitialiser" onPress={reset} variant="secondary" />
      </View>
    </View>
  );
  const displayStatus = validationError ? "idle" : status;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: "Recherche",
          headerRight: () => (
            <IconButton
              label="Réinitialiser la recherche"
              onPress={reset}
              icon={<RotateCcw size={19} strokeWidth={2.2} color={theme.accent} />}
            />
          ),
        }}
      />
      {!optionsResource.data ? (
        <ScreenState
          status={optionsResource.status === "error" ? "error" : "loading"}
          message={optionsResource.error?.message}
          onRetry={() => void reloadOptions()}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <>
              {renderForm}
              <View style={styles.resultsHeader}>
                <View>
                  <Text style={[styles.resultsEyebrow, { color: theme.accent }]}>RÉSULTATS</Text>
                  <Text style={[styles.resultsTitle, { color: theme.label }]}>
                    {displayStatus === "loading"
                      ? "Recherche en cours…"
                      : displayStatus !== "ready"
                        ? "En attente de critères"
                        : (results?.length ?? 0) + ((results?.length ?? 0) === 1 ? " transaction" : " transactions")}
                  </Text>
                </View>
                {displayStatus === "loading" ? <ActivityIndicator color={theme.accent} /> : null}
              </View>
              {error ? <InlineError message={error} onRetry={() => update({ query: criteria.query })} /> : null}
              {results && results.length === 200 ? (
                <Text style={[styles.limitHint, { color: theme.secondaryLabel }]}>
                  Les 200 résultats les plus récents sont affichés.
                </Text>
              ) : null}
            </>
          }
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionHeaderTitle, { color: theme.secondaryLabel }]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionHeaderTotal, { color: section.total >= 0 ? theme.label : theme.expense }]}>
                {formatAmount(section.total)}
              </Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <View
              style={[
                styles.resultRow,
                { backgroundColor: theme.surface },
                index === section.data.length - 1 && styles.resultRowLast,
              ]}
            >
              <TransactionRow transaction={item} onPress={() => openEdit(item.id)} />
            </View>
          )}
          ListEmptyComponent={
            displayStatus === "ready" ? (
              <EmptyState
                title="Aucune transaction trouvée"
                message="Modifiez les critères ou essayez une autre recherche."
              />
            ) : validationError ? null : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.lg },
  form: { gap: spacing.lg },
  hero: { padding: spacing.xl, borderRadius: radius.xl, gap: spacing.md, borderCurve: "continuous" },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
  },
  toggleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  searchInputWrap: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 52 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: spacing.md },
  dateRow: { flexDirection: "row", gap: spacing.sm },
  dateButton: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, minHeight: 62 },
  dateCopy: { flex: 1, gap: 2 },
  dateLabel: { fontSize: 12 },
  dateValue: { fontSize: 13, fontWeight: "700" },
  clearLink: { fontSize: 13, fontWeight: "700" },
  amountRow: { flexDirection: "row", gap: spacing.md },
  amountInput: { minHeight: 48, borderRadius: radius.lg, paddingHorizontal: spacing.md, fontSize: 16 },
  error: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  choiceGroup: { gap: StyleSheet.hairlineWidth, overflow: "hidden", borderRadius: radius.lg },
  choiceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, minHeight: 56 },
  choiceIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  choiceText: { flex: 1, gap: 2 },
  choiceLabel: { fontSize: 15, fontWeight: "600" },
  choiceDetail: { fontSize: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  actionRow: { alignItems: "flex-start" },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.md },
  resultsEyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  resultsTitle: { fontSize: 19, fontWeight: "800", marginTop: spacing.xs },
  limitHint: { fontSize: 12, marginTop: -spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  sectionHeaderTitle: { fontSize: 13, fontWeight: "700" },
  sectionHeaderTotal: { fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  resultRow: { overflow: "hidden" },
  resultRowLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
