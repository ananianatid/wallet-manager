import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, ChevronRight, RefreshCw } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { ActionButton, ContentSection, InlineError } from "@/components/ui";
import { CategoryIcon } from "@/components/category-icons";
import { formatAmount, formatDayLabel, formatShortDate } from "@/utils/format";
import { dashboardInsight } from "@/utils/dashboard";
import { radius, spacing, typography, useTheme, withAlpha } from "@/theme";

const DAY_MS = 86_400_000;
const FALLBACK_HORIZON_DAYS = 30;

type BudgetRow = {
  entity: CloudEntity;
  category: CloudEntity | null;
  spent: number;
  percentage: number;
  over: boolean;
};

type DashboardCalculation = {
  currentAvailable: number;
  amount: number;
  plannedIncome: number;
  plannedOutflows: number;
  savings: number;
  horizon: number;
  eventCount: number;
};

type TransactionGroup = {
  key: string;
  title: string;
  items: CloudEntity[];
};

function fields(entity: CloudEntity): Record<string, unknown> {
  return cloudFields(entity);
}

function textField(entity: CloudEntity, key: string, fallback = ""): string {
  const value = fields(entity)[key];
  return value == null || value === "" ? fallback : String(value);
}

function numberField(entity: CloudEntity, key: string): number {
  const value = Number(fields(entity)[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function timestamp(value: unknown): number {
  const number = Number(value ?? 0);
  return number > 0 && number < 10_000_000_000 ? number * 1000 : number;
}

function transactionDate(entity: CloudEntity): number {
  return timestamp(fields(entity).transaction_date ?? fields(entity).created_at);
}

function transactionType(entity: CloudEntity): string {
  return textField(entity, "type", "expense");
}

function amount(entity: CloudEntity): number {
  return numberField(entity, "amount");
}

function includedAccount(entity: CloudEntity): boolean {
  return numberField(entity, "exclude_from_total") === 0;
}

function accountFor(transaction: CloudEntity, accountsById: ReadonlyMap<string, CloudEntity>): CloudEntity | null {
  const accountId = cloudRefs(transaction).account_id;
  return accountId ? accountsById.get(accountId) ?? null : null;
}

function categoryFor(entity: CloudEntity, categoriesById: ReadonlyMap<string, CloudEntity>): CloudEntity | null {
  const categoryId = cloudRefs(entity).category_id;
  return categoryId ? categoriesById.get(categoryId) ?? null : null;
}

function impactFor(entity: CloudEntity, accountIds: ReadonlySet<string>): number {
  const refs = cloudRefs(entity);
  const type = transactionType(entity);
  const value = amount(entity);
  const fee = numberField(entity, "fee");
  const destinationAmount = numberField(entity, "destination_amount") || value;
  if (type === "income") return refs.account_id && accountIds.has(refs.account_id) ? value : 0;
  if (type === "expense") return refs.account_id && accountIds.has(refs.account_id) ? -value : 0;

  let impact = 0;
  if (refs.account_id && accountIds.has(refs.account_id)) impact -= value + fee;
  if (refs.destination_account_id && accountIds.has(refs.destination_account_id)) impact += destinationAmount;
  return impact;
}

function advanceDate(date: number, frequency: string, interval: number): number {
  const next = new Date(date);
  if (frequency === "daily") next.setDate(next.getDate() + interval);
  else if (frequency === "weekly") next.setDate(next.getDate() + interval * 7);
  else if (frequency === "yearly") next.setFullYear(next.getFullYear() + interval);
  else next.setMonth(next.getMonth() + interval);
  return next.getTime();
}

function calculateDashboard(entities: CloudEntity[], now: number, accountIds: ReadonlySet<string>): DashboardCalculation {
  const transactions = entities.filter((entity) => entity.entityType === "transactions");
  const recurring = entities.filter((entity) => entity.entityType === "recurring_transactions");
  const savingsRules = entities.filter((entity) => entity.entityType === "savings_rules");
  const currentBalance = transactions
    .filter((entity) => transactionDate(entity) <= now)
    .reduce((total, entity) => total + impactFor(entity, accountIds), 0);
  const goals = entities.filter((entity) => entity.entityType === "goals");
  const reservations = entities.filter((entity) => entity.entityType === "goal_reservations" && !fields(entity).released_at);
  const reservedFromReservations = reservations.reduce((total, entity) => total + (numberField(entity, "reference_amount") || amount(entity)), 0);
  const reservedFromGoals = goals.reduce((total, entity) => total + numberField(entity, "reserved_amount"), 0);
  const currentAvailable = currentBalance - (reservedFromReservations || reservedFromGoals);

  const futureIncomes = transactions.filter((entity) => transactionDate(entity) > now && transactionType(entity) === "income" && Boolean(cloudRefs(entity).account_id && accountIds.has(cloudRefs(entity).account_id!)));
  const recurringIncomes = recurring
    .filter((entity) => numberField(entity, "is_active") !== 0 && transactionType(entity) === "income")
    .map((entity) => timestamp(fields(entity).next_date))
    .filter(Boolean);
  const incomeDates = [...futureIncomes.map(transactionDate), ...recurringIncomes];
  const nextIncome = incomeDates.length > 0 ? Math.min(...incomeDates) : null;
  const horizon = nextIncome ?? now + FALLBACK_HORIZON_DAYS * DAY_MS;

  const events: number[] = [];
  transactions
    .filter((entity) => {
      const date = transactionDate(entity);
      const refs = cloudRefs(entity);
      return date > now && date <= horizon && Boolean((refs.account_id && accountIds.has(refs.account_id)) || (refs.destination_account_id && accountIds.has(refs.destination_account_id)));
    })
    .forEach((entity) => events.push(impactFor(entity, accountIds)));

  recurring
    .filter((entity) => {
      const refs = cloudRefs(entity);
      return numberField(entity, "is_active") !== 0 && Boolean((refs.account_id && accountIds.has(refs.account_id)) || (refs.destination_account_id && accountIds.has(refs.destination_account_id)));
    })
    .forEach((entity) => {
      let date = timestamp(fields(entity).next_date);
      const frequency = textField(entity, "frequency", "monthly");
      const interval = Math.max(1, numberField(entity, "interval") || 1);
      let guard = 0;
      while (date > 0 && date <= now && guard < 120) {
        date = advanceDate(date, frequency, interval);
        guard += 1;
      }
      while (date > 0 && date <= horizon && guard < 120) {
        events.push(impactFor(entity, accountIds));
        date = advanceDate(date, frequency, interval);
        guard += 1;
      }
    });

  const plannedIncome = events.filter((value) => value > 0).reduce((total, value) => total + value, 0);
  const plannedOutflows = events.filter((value) => value < 0).reduce((total, value) => total - value, 0);
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const nextMonth = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1).getTime();
  const savings = savingsRules.reduce((total, rule) => {
    if (numberField(rule, "subtract_from_available") === 0) return total;
    const categoryId = cloudRefs(rule).category_id;
    const income = transactions
      .filter((entity) => transactionDate(entity) >= monthStart && transactionDate(entity) < nextMonth && transactionType(entity) === "income" && (!categoryId || cloudRefs(entity).category_id === categoryId))
      .reduce((sum, entity) => sum + amount(entity), 0);
    return total + income * numberField(rule, "percent") / 100;
  }, 0);

  return { currentAvailable, amount: currentAvailable + plannedIncome - plannedOutflows - savings, plannedIncome, plannedOutflows, savings, horizon, eventCount: events.length };
}

function transactionLabel(transaction: CloudEntity, categoriesById: ReadonlyMap<string, CloudEntity>): string {
  const category = categoryFor(transaction, categoriesById);
  return textField(transaction, "merchant") || textField(transaction, "note") || textField(category ?? ({ payload: {} } as CloudEntity), "name", "Sans catégorie");
}

function transactionTypeLabel(type: string): string {
  return ({ expense: "Dépense", income: "Revenu", transfer: "Transfert" } as Record<string, string>)[type] ?? "Opération";
}

function dateGroupLabel(date: number): string {
  return date ? formatDayLabel(date) : "Date inconnue";
}

function groupTransactionsByDay(transactions: CloudEntity[]): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();
  for (const transaction of transactions) {
    const date = new Date(transactionDate(transaction));
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const group = groups.get(key) ?? { key, title: dateGroupLabel(transactionDate(transaction)), items: [] };
    group.items.push(transaction);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function CloudTransactionRow({ transaction, accountsById, categoriesById, currency }: { transaction: CloudEntity; accountsById: ReadonlyMap<string, CloudEntity>; categoriesById: ReadonlyMap<string, CloudEntity>; currency: string }) {
  const theme = useTheme();
  const type = transactionType(transaction);
  const category = categoryFor(transaction, categoriesById);
  const account = accountFor(transaction, accountsById);
  const title = transactionLabel(transaction, categoriesById);
  const isIncome = type === "income";
  const isExpense = type === "expense";
  const amountColor = isIncome ? theme.income : isExpense ? theme.expense : theme.label;
  const sign = isIncome ? "+" : isExpense ? "−" : "";
  const detail = [account ? textField(account, "name", "Compte") : "Compte", category ? textField(category, "name", "Catégorie") : transactionTypeLabel(type), dateGroupLabel(transactionDate(transaction))].join(" · ");

  return (
    <Pressable onPress={() => router.push({ pathname: "/app/activity/[id]" as never, params: { id: transaction.entityId } })} accessibilityRole="link" accessibilityLabel={`Ouvrir ${title}`} style={({ pressed }) => [styles.transactionRow, pressed && styles.pressed]}>
      <View style={[styles.categoryIcon, { backgroundColor: theme.surfaceElevated }]}>
        {type === "transfer" ? <ArrowLeftRight size={17} color={theme.accent} /> : <CategoryIcon name={textField(category ?? ({ payload: {} } as CloudEntity), "icon", "tag") as never} size={17} color={theme.accent} />}
      </View>
      <View style={styles.transactionBody}>
        <Text numberOfLines={1} style={[styles.transactionTitle, { color: theme.label }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.transactionDetail, { color: theme.secondaryLabel }]}>{detail}</Text>
        {textField(transaction, "note") && textField(transaction, "note") !== title ? <Text numberOfLines={1} style={[styles.transactionDetail, { color: theme.secondaryLabel }]}>{textField(transaction, "note")}</Text> : null}
      </View>
      <Text selectable numberOfLines={2} style={[styles.transactionAmount, { color: amountColor }]}>{sign}{formatAmount(amount(transaction), currency)}</Text>
      <ChevronRight size={18} color={theme.secondaryLabel} />
    </Pressable>
  );
}

function WebSafeToSpendCard({ calculation, currency, onPress }: { calculation: DashboardCalculation; currency: string; onPress: () => void }) {
  const theme = useTheme();
  const isNegative = calculation.currentAvailable < 0;
  const forecastIsNegative = calculation.amount < 0;
  const surface = isNegative ? theme.dangerSurface : theme.accentSurface;
  const label = isNegative ? theme.dangerSurfaceLabel : theme.accentSurfaceLabel;
  const value = isNegative ? theme.dangerSurfaceText : theme.accentSurfaceIncome;
  const supporting = isNegative ? theme.dangerSurfaceExpense : theme.accentSurfaceExpense;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Patrimoine disponible maintenant : ${formatAmount(calculation.currentAvailable, currency)}`} style={({ pressed }) => [styles.safeCard, { backgroundColor: surface }, pressed && styles.pressed]}>
      <View style={styles.safeHeading}><Text style={[styles.safeLabel, { color: label }]}>PATRIMOINE DISPONIBLE</Text><ChevronRight size={18} color={label} /></View>
      <Text selectable style={[styles.safeAmount, { color: value }]}>{formatAmount(calculation.currentAvailable, currency)}</Text>
      <Text style={{ color: label, fontSize: 13, fontWeight: "600" }}>Disponible maintenant, avant les échéances</Text>
      <View style={[styles.safeForecast, { borderTopColor: withAlpha(label, "66") }]}>
        <View style={styles.safeForecastHeader}><Text style={{ color: label, fontSize: 11, fontWeight: "600", letterSpacing: 0.4 }}>APRÈS LES ÉCHÉANCES</Text><Text style={{ color: forecastIsNegative ? supporting : value, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{formatAmount(calculation.amount, currency)}</Text></View>
        {calculation.plannedIncome > 0 || calculation.plannedOutflows > 0 ? <Text style={{ color: label, fontSize: 12 }}>{calculation.plannedIncome > 0 ? `+${formatAmount(calculation.plannedIncome, currency)} à venir` : ""}{calculation.plannedIncome > 0 && calculation.plannedOutflows > 0 ? " · " : ""}{calculation.plannedOutflows > 0 ? `−${formatAmount(calculation.plannedOutflows, currency)} prévues` : ""}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function WebCloudDashboard() {
  const theme = useTheme();
  const [entities, setEntities] = useState<CloudEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadCloudBootstrap(["accounts", "transactions", "categories", "budget_plans", "goals", "savings_rules", "recurring_transactions", "goal_reservations"]);
      setEntities(result.entities.filter((entity) => entity.payload !== null));
      setNow(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger vos données cloud.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The first remote load intentionally synchronizes component state after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const accounts = useMemo(() => entities.filter((entity) => entity.entityType === "accounts"), [entities]);
  const transactions = useMemo(() => entities.filter((entity) => entity.entityType === "transactions").sort((a, b) => transactionDate(b) - transactionDate(a)), [entities]);
  const categories = useMemo(() => entities.filter((entity) => entity.entityType === "categories"), [entities]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.entityId, category])), [categories]);
  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.entityId, account])), [accounts]);
  const accountIds = useMemo(() => new Set(accounts.filter(includedAccount).map((account) => account.entityId)), [accounts]);
  const currencySet = useMemo(() => new Set(accounts.filter(includedAccount).map((account) => textField(account, "currency_code", "XOF").toUpperCase())), [accounts]);
  const currency = currencySet.size === 1 ? [...currencySet][0] : "XOF";
  const mixedCurrency = currencySet.size > 1;
  const budgets = useMemo(() => entities.filter((entity) => entity.entityType === "budget_plans" && numberField(entity, "is_active") !== 0), [entities]);
  const goals = useMemo(() => entities.filter((entity) => entity.entityType === "goals" && textField(entity, "status", "active") === "active"), [entities]);
  const savingsRules = useMemo(() => entities.filter((entity) => entity.entityType === "savings_rules"), [entities]);
  const calculation = useMemo(() => calculateDashboard(entities, now, accountIds), [accountIds, entities, now]);
  const monthStart = useMemo(() => new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime(), [now]);
  const nextMonth = useMemo(() => new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1).getTime(), [now]);
  const monthTransactions = useMemo(() => transactions.filter((entity) => transactionDate(entity) >= monthStart && transactionDate(entity) < nextMonth), [monthStart, nextMonth, transactions]);
  const previousMonthStart = useMemo(() => new Date(new Date(now).getFullYear(), new Date(now).getMonth() - 1, 1).getTime(), [now]);
  const totalExpense = useMemo(() => monthTransactions.filter((entity) => transactionType(entity) === "expense").reduce((total, entity) => total + amount(entity), 0), [monthTransactions]);
  const previousMonthExpense = useMemo(() => transactions.filter((entity) => transactionDate(entity) >= previousMonthStart && transactionDate(entity) < monthStart && transactionType(entity) === "expense").reduce((total, entity) => total + amount(entity), 0), [monthStart, previousMonthStart, transactions]);
  const recent = useMemo(() => transactions.filter((entity) => transactionDate(entity) <= now).slice(0, 5), [now, transactions]);
  const upcoming = useMemo(() => transactions.filter((entity) => transactionDate(entity) > now).sort((a, b) => transactionDate(a) - transactionDate(b)).slice(0, 3), [now, transactions]);
  const recentGroups = useMemo(() => groupTransactionsByDay(recent), [recent]);
  const upcomingGroups = useMemo(() => groupTransactionsByDay(upcoming), [upcoming]);
  const spentByCategory = useMemo(() => {
    const result = new Map<string, number>();
    for (const transaction of monthTransactions) {
      if (transactionType(transaction) !== "expense") continue;
      const categoryId = cloudRefs(transaction).category_id;
      if (categoryId) result.set(categoryId, (result.get(categoryId) ?? 0) + amount(transaction));
    }
    return result;
  }, [monthTransactions]);
  const budgetRows = useMemo<BudgetRow[]>(() => budgets.map((budget) => {
    const category = categoryFor(budget, categoriesById);
    const categoryId = cloudRefs(budget).category_id;
    const spent = categoryId ? spentByCategory.get(categoryId) ?? 0 : totalExpense;
    const budgetAmount = amount(budget);
    return { entity: budget, category, spent, percentage: budgetAmount > 0 ? Math.min((spent / budgetAmount) * 100, 100) : 0, over: spent > budgetAmount };
  }), [budgets, categoriesById, spentByCategory, totalExpense]);
  const budgetRemaining = useMemo(() => budgetRows.length === 0 ? null : budgetRows.reduce((total, row) => total + Math.max(amount(row.entity) - row.spent, 0), 0), [budgetRows]);
  const savingsTotal = useMemo(() => savingsRules.reduce((total, rule) => {
    const categoryId = cloudRefs(rule).category_id;
    const income = transactions.filter((entity) => transactionType(entity) === "income" && (!categoryId || cloudRefs(entity).category_id === categoryId)).reduce((sum, entity) => sum + amount(entity), 0);
    return total + income * numberField(rule, "percent") / 100;
  }, 0), [savingsRules, transactions]);
  const goalTarget = useMemo(() => goals.reduce((total, goal) => total + numberField(goal, "target_amount"), 0), [goals]);
  const insight = useMemo(() => dashboardInsight({ totalExpense, previousMonthExpense, hasCurrentActivity: monthTransactions.length > 0, hasPreviousActivity: previousMonthExpense > 0, budgetRemaining, hasOverBudget: budgetRows.some((row) => row.over) }), [budgetRemaining, budgetRows, monthTransactions.length, previousMonthExpense, totalExpense]);

  if (loading) return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={[styles.stateTitle, { color: theme.label }]}>Chargement de votre accueil…</Text></View>;
  if (error) return <View style={[styles.state, { backgroundColor: theme.background }]}><InlineError message={error} onRetry={() => void load()} /><ActionButton label="Réessayer" onPress={() => void load()} /></View>;

  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
      <View style={styles.heading}><View><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>ACCUEIL</Text><Text style={[styles.title, { color: theme.label }]}>Votre situation</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Actualiser l’accueil" onPress={() => void load()} style={[styles.refresh, { borderColor: theme.separator }]}><RefreshCw size={17} color={theme.accent} /><Text style={[styles.refreshLabel, { color: theme.accent }]}>Actualiser</Text></Pressable></View>
      {accounts.length === 0 ? <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.emptyTitle, { color: theme.label }]}>Ajoutez votre premier compte financier</Text><Text style={[styles.emptyText, { color: theme.secondaryLabel }]}>Ajoutez une banque, une caisse ou un portefeuille mobile pour enregistrer vos transactions.</Text><ActionButton label="Ajouter un compte financier" onPress={() => router.push("/app/accounts/new")} /></View> : <>
        <WebSafeToSpendCard calculation={calculation} currency={currency} onPress={() => router.push("/app/cashflow" as never)} />
        {mixedCurrency ? <View style={[styles.notice, { backgroundColor: theme.surfaceElevated }]}><Text style={{ color: theme.secondaryLabel }}>Plusieurs devises sont présentes. Les synthèses web affichent les montants sans conversion.</Text></View> : null}
        <View style={styles.statsGrid}><View style={styles.statsRow}><DashboardStat label="Dépenses ce mois" value={formatAmount(totalExpense, currency)} color={theme.expense} /><DashboardStat label="Budget restant" value={budgetRemaining == null ? "—" : formatAmount(budgetRemaining, currency)} color={budgetRemaining === 0 ? theme.expense : theme.label} /></View><View style={styles.statsRow}><DashboardStat label="Épargne" value={formatAmount(savingsTotal, currency)} color={theme.income} /><DashboardStat label="Prochaine échéance" value={upcoming[0] ? formatShortDate(transactionDate(upcoming[0])) : "—"} color={upcoming[0] ? theme.label : theme.secondaryLabel} /></View></View>
        <View accessible accessibilityRole="summary" accessibilityLabel={`Insight : ${insight.title}. ${insight.body}`} style={[styles.insightCard, { backgroundColor: withAlpha(insight.level === "warning" ? theme.expense : theme.income, "18") }]}>{insight.level === "warning" ? <AlertTriangle size={18} color={theme.expense} /> : null}<View style={styles.insightCopy}><Text style={[styles.insightTitle, { color: insight.level === "warning" ? theme.expense : theme.label }]}>{insight.title}</Text><Text style={[styles.insightBody, { color: theme.secondaryLabel }]}>{insight.body}</Text></View></View>
        {budgetRows.length > 0 ? <ContentSection title="Budgets du mois" action={{ label: "Tout voir", onPress: () => router.push("/app/planning") }}>{budgetRows.map((row) => <View key={row.entity.entityId} style={styles.budgetRow}><View style={[styles.budgetIcon, { backgroundColor: theme.surfaceElevated }]}><CategoryIcon name={textField(row.category ?? ({ payload: {} } as CloudEntity), "icon", "tag") as never} size={18} color={theme.accent} /></View><View style={styles.budgetBody}><View style={styles.budgetHeader}><Text numberOfLines={1} style={[styles.budgetTitle, { color: theme.label }]}>{textField(row.category ?? ({ payload: {} } as CloudEntity), "name", "Toutes les dépenses")}</Text><Text style={[styles.budgetAmount, { color: row.over ? theme.expense : theme.secondaryLabel }]}>{formatAmount(row.spent, currency)} / {formatAmount(amount(row.entity), currency)}</Text></View><View accessible accessibilityRole="progressbar" accessibilityLabel={`${textField(row.category ?? ({ payload: {} } as CloudEntity), "name", "Toutes les dépenses")} : ${formatAmount(row.spent, currency)} dépensés sur ${formatAmount(amount(row.entity), currency)}`} style={[styles.budgetTrack, { backgroundColor: theme.surfaceElevated }]}><View style={{ width: `${row.percentage}%`, height: "100%", borderRadius: radius.md, backgroundColor: row.over ? theme.expense : theme.accent }} /></View></View></View>)}</ContentSection> : null}
        {goals.length > 0 || savingsRules.length > 0 ? <ContentSection title="Vos plans" action={{ label: "Tout voir", onPress: () => router.push("/app/planning") }}>{goals.length > 0 ? <Pressable onPress={() => router.push("/app/planning")} accessibilityRole="button" style={({ pressed }) => [styles.planningRow, pressed && styles.pressed]}><View style={styles.planningCopy}><Text style={[styles.planningTitle, { color: theme.label }]}>Objectifs</Text><Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>{formatAmount(goalTarget, currency)}</Text></View><ChevronRight size={18} color={theme.secondaryLabel} /></Pressable> : null}<Pressable onPress={() => router.push("/app/planning")} accessibilityRole="button" style={({ pressed }) => [styles.planningRow, pressed && styles.pressed]}><View style={styles.planningCopy}><Text style={[styles.planningTitle, { color: theme.label }]}>Épargne</Text><Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>{savingsRules.length > 0 ? `${savingsRules.length} règle${savingsRules.length > 1 ? "s" : ""} active${savingsRules.length > 1 ? "s" : ""} · Total épargné depuis le début : ${formatAmount(savingsTotal, currency)}` : "Mettre automatiquement de côté"}</Text></View><ChevronRight size={18} color={theme.secondaryLabel} /></Pressable></ContentSection> : null}
        {recentGroups.length > 0 ? <ContentSection title="Derniers mouvements" action={{ label: "Tout voir", onPress: () => router.push("/app/activity") }}>{recentGroups.map((group) => <View key={group.key} style={[styles.transactionGroup, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.groupTitle, { color: theme.secondaryLabel }]}>{group.title}</Text>{group.items.map((transaction, index) => <View key={transaction.entityId}>{index > 0 ? <View style={[styles.divider, { backgroundColor: theme.separator }]} /> : null}<CloudTransactionRow transaction={transaction} accountsById={accountsById} categoriesById={categoriesById} currency={currency} /></View>)}</View>)}</ContentSection> : null}
        {upcomingGroups.length > 0 ? <ContentSection title="Prochains mouvements" action={{ label: "Tout voir", onPress: () => router.push("/app/activity") }}>{upcomingGroups.map((group) => <View key={group.key} style={[styles.transactionGroup, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.groupTitle, { color: theme.secondaryLabel }]}>{group.title}</Text>{group.items.map((transaction, index) => <View key={transaction.entityId}>{index > 0 ? <View style={[styles.divider, { backgroundColor: theme.separator }]} /> : null}<CloudTransactionRow transaction={transaction} accountsById={accountsById} categoriesById={categoriesById} currency={currency} /></View>)}</View>)}</ContentSection> : null}
        {!budgets.length || !goals.length || !savingsRules.length ? <ContentSection title="Premiers réglages">{!budgets.length ? <SetupRow title="Créer un budget" detail="Suivez vos dépenses par catégorie." onPress={() => router.push("/app/planning/new?type=budget_plans" as never)} /> : null}{!goals.length ? <SetupRow title="Définir un objectif" detail="Mettez de côté pour un projet précis." onPress={() => router.push("/app/planning/new?type=goals" as never)} /> : null}{!savingsRules.length ? <SetupRow title="Configurer une épargne" detail="Mettez régulièrement de côté." onPress={() => router.push("/app/planning/new?type=savings_rules" as never)} /> : null}</ContentSection> : null}
      </>}
    </ScrollView>
  );
}

function DashboardStat({ label, value, color }: { label: string; value: string; color: string }) {
  const theme = useTheme();
  return <View accessible accessibilityRole="summary" accessibilityLabel={`${label} : ${value}`} style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.statLabel, { color: theme.secondaryLabel }]}>{label}</Text><Text selectable numberOfLines={1} style={[styles.statValue, { color }]}>{value}</Text></View>;
}

function SetupRow({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.setupRow, pressed && styles.pressed]}><View style={styles.planningCopy}><Text style={[styles.planningTitle, { color: theme.label }]}>{title}</Text><Text style={[styles.planningDetail, { color: theme.secondaryLabel }]}>{detail}</Text></View><ChevronRight size={18} color={theme.secondaryLabel} /></Pressable>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: "100%", maxWidth: 1080, alignSelf: "center", padding: spacing.xl, gap: spacing.xl },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: { ...typography.display },
  refresh: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  refreshLabel: { fontSize: 13, fontWeight: "700" },
  safeCard: { gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl },
  safeHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  safeLabel: { fontSize: 13, fontWeight: "600" },
  safeAmount: { ...typography.amount, fontSize: 38, lineHeight: 44, fontVariant: ["tabular-nums"] },
  safeForecast: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  safeForecastHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  statsGrid: { gap: spacing.md },
  statsRow: { flexDirection: "row", gap: spacing.md },
  statCard: { flex: 1, minWidth: 0, minHeight: 100, justifyContent: "space-between", padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 13, fontWeight: "600" },
  statValue: { fontSize: 21, fontWeight: "800", fontVariant: ["tabular-nums"] },
  insightCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg },
  insightCopy: { flex: 1, gap: spacing.xs },
  insightTitle: { fontWeight: "800" },
  insightBody: { fontSize: 13, lineHeight: 19 },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  budgetIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  budgetBody: { flex: 1, gap: 6 },
  budgetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  budgetTitle: { flex: 1, fontWeight: "500" },
  budgetAmount: { fontSize: 12, fontVariant: ["tabular-nums"] },
  budgetTrack: { height: 6, borderRadius: radius.md, overflow: "hidden" },
  planningRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 56, paddingVertical: spacing.xs },
  planningCopy: { flex: 1, gap: spacing.xs },
  planningTitle: { fontWeight: "500" },
  planningDetail: { fontSize: 13 },
  transactionGroup: { overflow: "hidden", borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  groupTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs, fontSize: 12, fontWeight: "600" },
  transactionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 72 },
  categoryIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  transactionBody: { flex: 1, gap: 2 },
  transactionTitle: { fontSize: 15, fontWeight: "600" },
  transactionDetail: { fontSize: 12, lineHeight: 17, fontVariant: ["tabular-nums"] },
  transactionAmount: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  divider: { height: StyleSheet.hairlineWidth },
  setupRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 56, paddingVertical: spacing.xs },
  notice: { padding: spacing.md, borderRadius: radius.md },
  empty: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyText: { maxWidth: 620, fontSize: 14, lineHeight: 21, textAlign: "center" },
  state: { flex: 1, minHeight: 420, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.7 },
});
