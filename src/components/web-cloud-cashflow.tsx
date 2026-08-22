import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarClock, RefreshCw, WalletCards } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields, cloudRefs } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { formatAmount, formatShortDate } from "@/utils/format";
import { spacing, typography, useTheme } from "@/theme";

const DAY_MS = 86_400_000;
const FALLBACK_HORIZON_DAYS = 30;

function fields(entity: CloudEntity): Record<string, unknown> { return cloudFields(entity); }
function stringField(entity: CloudEntity, key: string, fallback: string): string { const value = fields(entity)[key]; return value == null || value === "" ? fallback : String(value); }
function numberField(entity: CloudEntity, key: string): number { return Number(fields(entity)[key] ?? 0); }
function timestamp(value: unknown): number { const number = Number(value ?? 0); return number > 0 && number < 10_000_000_000 ? number * 1000 : number; }
function included(entity: CloudEntity): boolean { return numberField(entity, "exclude_from_total") === 0; }
function amountFor(entity: CloudEntity): number { return numberField(entity, "amount"); }

function entityImpact(entity: CloudEntity, accountIds: Set<string>): number {
  const refs = cloudRefs(entity);
  const type = stringField(entity, "type", "expense");
  const amount = amountFor(entity);
  const fee = numberField(entity, "fee");
  const destinationAmount = numberField(entity, "destination_amount") || amount;
  if (type === "income") return refs.account_id && accountIds.has(refs.account_id) ? amount : 0;
  if (type === "expense") return refs.account_id && accountIds.has(refs.account_id) ? -amount : 0;
  let impact = 0;
  if (refs.account_id && accountIds.has(refs.account_id)) impact -= amount + fee;
  if (refs.destination_account_id && accountIds.has(refs.destination_account_id)) impact += destinationAmount;
  return impact;
}

function advanceDate(date: number, frequency: string, interval: number): number {
  const next = new Date(date);
  if (frequency === "daily") next.setDate(next.getDate() + interval);
  else if (frequency === "weekly") next.setDate(next.getDate() + 7 * interval);
  else if (frequency === "yearly") next.setFullYear(next.getFullYear() + interval);
  else next.setMonth(next.getMonth() + interval);
  return next.getTime();
}

function labelFor(type: string): string { return type === "income" ? "Revenus prévus" : "Échéances prévues"; }

export default function WebCloudCashflow() {
  const theme = useTheme();
  const [entities, setEntities] = useState<CloudEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await loadCloudBootstrap(["accounts", "transactions", "recurring_transactions", "goals", "savings_rules", "goal_reservations"]);
      setEntities(result.entities.filter((entity) => entity.payload !== null));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de calculer les dépenses sûres cloud."); }
    finally { setLoading(false); }
  }, []);

  // The first remote load intentionally synchronizes component state after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const accounts = useMemo(() => entities.filter((entity) => entity.entityType === "accounts"), [entities]);
  const accountIds = useMemo(() => new Set(accounts.filter(included).map((entity) => entity.entityId)), [accounts]);
  const transactions = useMemo(() => entities.filter((entity) => entity.entityType === "transactions"), [entities]);
  const recurring = useMemo(() => entities.filter((entity) => entity.entityType === "recurring_transactions"), [entities]);
  const goals = useMemo(() => entities.filter((entity) => entity.entityType === "goals"), [entities]);
  const savingsRules = useMemo(() => entities.filter((entity) => entity.entityType === "savings_rules"), [entities]);
  const currencies = useMemo(() => new Set(accounts.filter(included).map((entity) => stringField(entity, "currency_code", "XOF").toUpperCase())), [accounts]);
  const currency = currencies.size === 1 ? [...currencies][0] : "XOF";

  const calculation = useMemo(() => {
    const currentTransactions = transactions.filter((entity) => timestamp(fields(entity).transaction_date) <= now);
    const currentBalance = currentTransactions.reduce((total, entity) => {
      const refs = cloudRefs(entity);
      const type = stringField(entity, "type", "");
      const amount = amountFor(entity);
      const fee = numberField(entity, "fee");
      const destinationAmount = numberField(entity, "destination_amount") || amount;
      let impact = 0;
      if (type === "income" && refs.account_id && accountIds.has(refs.account_id)) impact += amount;
      if (type === "expense" && refs.account_id && accountIds.has(refs.account_id)) impact -= amount;
      if (type === "transfer") {
        if (refs.account_id && accountIds.has(refs.account_id)) impact -= amount + fee;
        if (refs.destination_account_id && accountIds.has(refs.destination_account_id)) impact += destinationAmount;
      }
      return total + impact;
    }, 0);
    const reservations = entities.filter((entity) => entity.entityType === "goal_reservations" && !fields(entity).released_at);
    const reservationTotal = reservations.reduce((total, reservation) => total + (numberField(reservation, "reference_amount") || numberField(reservation, "amount")), 0);
    const reservedFromGoals = goals.reduce((total, goal) => total + numberField(goal, "reserved_amount"), 0);
    const reserved = reservationTotal || reservedFromGoals;
    const currentAvailable = currentBalance - reserved;
    const futureIncomes = transactions.filter((entity) => timestamp(fields(entity).transaction_date) > now && stringField(entity, "type", "") === "income" && cloudRefs(entity).account_id && accountIds.has(cloudRefs(entity).account_id!));
    const nextIncome = [...futureIncomes.map((entity) => timestamp(fields(entity).transaction_date)), ...recurring.filter((entity) => numberField(entity, "is_active") !== 0 && stringField(entity, "type", "") === "income").map((entity) => timestamp(fields(entity).next_date)).filter(Boolean)];
    const nextIncomeDate = nextIncome.length > 0 ? Math.min(...nextIncome) : null;
    const horizon = nextIncomeDate ?? now + FALLBACK_HORIZON_DAYS * DAY_MS;
    const events: { impact: number; date: number; label: string }[] = [];
    transactions.filter((entity) => { const date = timestamp(fields(entity).transaction_date); const refs = cloudRefs(entity); return date > now && date <= horizon && Boolean((refs.account_id && accountIds.has(refs.account_id)) || (refs.destination_account_id && accountIds.has(refs.destination_account_id))); }).forEach((entity) => {
      const type = stringField(entity, "type", "expense");
      events.push({ impact: entityImpact(entity, accountIds), date: timestamp(fields(entity).transaction_date), label: labelFor(type) });
    });
    recurring.filter((entity) => { const refs = cloudRefs(entity); return numberField(entity, "is_active") !== 0 && Boolean((refs.account_id && accountIds.has(refs.account_id)) || (refs.destination_account_id && accountIds.has(refs.destination_account_id))); }).forEach((entity) => {
      let date = timestamp(fields(entity).next_date);
      const frequency = stringField(entity, "frequency", "monthly");
      const interval = Math.max(1, numberField(entity, "interval") || 1);
      let guard = 0;
      while (date > 0 && date <= now && guard < 120) { date = advanceDate(date, frequency, interval); guard += 1; }
      while (date > 0 && date <= horizon && guard < 120) {
        events.push({ impact: entityImpact(entity, accountIds), date, label: labelFor(stringField(entity, "type", "expense")) });
        date = advanceDate(date, frequency, interval); guard += 1;
      }
    });
    const plannedIncome = events.filter((event) => event.impact > 0).reduce((total, event) => total + event.impact, 0);
    const plannedOutflows = events.filter((event) => event.impact < 0).reduce((total, event) => total - event.impact, 0);
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
    const nextMonth = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1).getTime();
    const savings = savingsRules.filter((rule) => numberField(rule, "subtract_from_available") !== 0).reduce((total, rule) => {
      const percent = numberField(rule, "percent");
      const categoryId = cloudRefs(rule).category_id;
      const income = transactions.filter((entity) => timestamp(fields(entity).transaction_date) >= monthStart && timestamp(fields(entity).transaction_date) < nextMonth && stringField(entity, "type", "") === "income" && (!categoryId || cloudRefs(entity).category_id === categoryId)).reduce((sum, entity) => sum + amountFor(entity), 0);
      return total + income * percent / 100;
    }, 0);
    const amount = currentAvailable + plannedIncome - plannedOutflows - savings;
    return { amount, currentBalance, currentAvailable, reserved, plannedIncome, plannedOutflows, savings, horizon, eventCount: events.length };
  }, [accountIds, entities, goals, now, recurring, savingsRules, transactions]);

  if (loading) return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={{ color: theme.label }}>Calcul des dépenses sûres…</Text></View>;
  if (error) return <View style={[styles.state, { backgroundColor: theme.background }]}><InlineError message={error} onRetry={() => void load()} /><ActionButton label="Réessayer" onPress={() => void load()} /></View>;
  const mixedCurrency = currencies.size > 1;
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}><View style={styles.heading}><View><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>ESPACE CLOUD · DÉCISION</Text><Text style={[styles.title, { color: theme.label }]}>Dépenses sûres</Text><Text style={[styles.lead, { color: theme.secondaryLabel }]}>Une estimation lisible de ce que vous pouvez engager avant votre prochain revenu ou dans les 30 prochains jours.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Actualiser le calcul" onPress={() => void load()} style={[styles.refresh, { borderColor: theme.separator }]}><RefreshCw size={17} color={theme.accent} /><Text style={{ color: theme.accent, fontWeight: "700" }}>Actualiser</Text></Pressable></View>{accounts.length === 0 ? <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.separator }]}><WalletCards size={26} color={theme.accent} /><Text style={[styles.emptyTitle, { color: theme.label }]}>Aucun compte financier</Text><Text style={{ color: theme.secondaryLabel }}>Ajoutez un compte cloud pour calculer vos dépenses sûres.</Text><ActionButton label="Ajouter un compte" onPress={() => router.push("/app/accounts/new")} /></View> : <><View style={[styles.hero, { backgroundColor: theme.accentSurface }]}><Text style={{ color: theme.accentSurfaceLabel, fontWeight: "800", letterSpacing: 0.8 }}>DISPONIBLE ESTIMÉ</Text><Text style={[styles.heroAmount, { color: calculation.amount >= 0 ? theme.accentSurfaceIncome : theme.accentSurfaceExpense }]}>{formatAmount(calculation.amount, currency)}</Text><Text style={{ color: theme.accentSurfaceLabel }}>{mixedCurrency ? "Calcul indicatif : plusieurs devises cloud sont présentes et ne sont pas converties." : `Horizon : ${calculation.horizon > now + FALLBACK_HORIZON_DAYS * DAY_MS - 1 ? formatShortDate(calculation.horizon) : "30 prochains jours"}.`}</Text></View><View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.sectionTitle, { color: theme.label }]}>Le calcul</Text><Text style={{ color: theme.secondaryLabel, lineHeight: 20 }}>Disponible estimé = disponible maintenant + revenus prévus − échéances prévues − épargne prévue. Les réserves d’objectifs sont retirées du disponible maintenant.</Text><BreakdownRow icon={WalletCards} label="Disponible maintenant" value={calculation.currentAvailable} color={theme.label} currency={currency} labelColor={theme.label} /><BreakdownRow icon={ArrowUp} label="Revenus prévus" value={calculation.plannedIncome} color={theme.income} currency={currency} labelColor={theme.label} /><BreakdownRow icon={ArrowDown} label="Échéances prévues" value={-calculation.plannedOutflows} color={theme.expense} currency={currency} labelColor={theme.label} /><BreakdownRow icon={CalendarClock} label="Épargne prévue" value={-calculation.savings} color={theme.accent} currency={currency} labelColor={theme.label} /><Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Comptes inclus : {accounts.filter(included).length} · Éléments prévus : {calculation.eventCount}</Text></View><View style={[styles.note, { backgroundColor: theme.surfaceElevated }]}><Text style={[styles.noteTitle, { color: theme.label }]}>Limite de l’estimation web</Text><Text style={{ color: theme.secondaryLabel, lineHeight: 20 }}>Le web calcule à partir des entités cloud synchronisées. Les conversions de devise et les règles serveur non présentes dans le bootstrap ne sont pas inventées ; consultez le détail avant une décision importante.</Text></View></>}</ScrollView>;
}

function BreakdownRow({ icon: Icon, label, value, color, currency, labelColor }: { icon: typeof WalletCards; label: string; value: number; color: string; currency: string; labelColor: string }) { return <View style={styles.row}><View style={styles.rowLabel}><Icon size={16} color={color} /><Text style={{ color: labelColor, flex: 1 }}>{label}</Text></View><Text style={{ color, fontWeight: "800" }}>{value < 0 ? "−" : "+"}{formatAmount(Math.abs(value), currency)}</Text></View>; }

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.lg, flexWrap: "wrap" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { ...typography.display }, lead: { maxWidth: 720, fontSize: 15, lineHeight: 22, marginTop: spacing.sm }, refresh: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14 }, hero: { gap: spacing.sm, padding: spacing.xl, borderRadius: 24 }, heroAmount: { fontSize: 42, fontWeight: "800" }, panel: { maxWidth: 820, gap: spacing.md, borderWidth: 1, borderRadius: 20, padding: spacing.xl }, sectionTitle: { fontSize: 18, fontWeight: "800" }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DCE5DD" }, rowLabel: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }, note: { maxWidth: 820, gap: spacing.sm, padding: spacing.lg, borderRadius: 16 }, noteTitle: { fontWeight: "800" }, empty: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: 20, padding: spacing.xl }, emptyTitle: { fontSize: 18, fontWeight: "800" }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
});
