import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, ChevronRight, PiggyBank, Plus, RefreshCcw, Target } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadCloudBootstrap, type CloudEntity } from "@/cloud/api";
import { cloudFields } from "@/cloud/domain";
import { ActionButton, InlineError } from "@/components/ui";
import { formatAmount, formatShortDate } from "@/utils/format";
import { spacing, typography, useTheme, withAlpha } from "@/theme";

type PlanningType = "budget_plans" | "goals" | "savings_rules" | "recurring_transactions";

const TYPE_LABELS: Record<PlanningType, string> = {
  budget_plans: "Budgets",
  goals: "Objectifs",
  savings_rules: "Épargne automatique",
  recurring_transactions: "Transactions récurrentes",
};

const TYPE_ICONS: Record<PlanningType, typeof Target> = {
  budget_plans: Target,
  goals: Target,
  savings_rules: PiggyBank,
  recurring_transactions: RefreshCcw,
};

function fields(entity: CloudEntity): Record<string, unknown> { return cloudFields(entity); }
function numberField(entity: CloudEntity, key: string): number { return Number(fields(entity)[key] ?? 0); }
function stringField(entity: CloudEntity, key: string, fallback: string): string { const value = fields(entity)[key]; return value == null || value === "" ? fallback : String(value); }
function shortDate(value: number, fallback: string): string { return value > 0 ? formatShortDate(value) : fallback; }

function PlanRow({ entity, type, onPress }: { entity: CloudEntity; type: PlanningType; onPress: () => void }) {
  const theme = useTheme();
  const Icon = TYPE_ICONS[type];
  const item = fields(entity);
  const title = type === "budget_plans" ? stringField(entity, "category_name", "Toutes les dépenses") : type === "goals" ? stringField(entity, "name", "Objectif sans nom") : type === "savings_rules" ? `${numberField(entity, "percent")}% des revenus` : `${typeLabel(String(item.type))} · ${formatAmount(numberField(entity, "amount"), String(item.currency_code ?? "XOF"))}`;
  const detail = type === "budget_plans" ? `${formatAmount(numberField(entity, "amount"), String(item.currency_code ?? "XOF"))} par période` : type === "goals" ? `Cible le ${shortDate(numberField(entity, "target_date"), "date à définir")} · ${formatAmount(numberField(entity, "reserved_amount"), String(item.currency_code ?? "XOF"))} réservé` : type === "savings_rules" ? (numberField(entity, "subtract_from_available") ? "Retirée du disponible estimé" : "Règle informative") : `${frequencyLabel(stringField(entity, "frequency", "monthly"))} · prochaine échéance ${shortDate(numberField(entity, "next_date"), "date à définir")}`;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} style={({ pressed }) => [styles.planRow, { backgroundColor: theme.surface }, pressed && styles.pressed]}><View style={[styles.icon, { backgroundColor: withAlpha(theme.accent, "16") }]}><Icon size={19} color={theme.accent} /></View><View style={styles.copy}><Text style={[styles.rowTitle, { color: theme.label }]} numberOfLines={1}>{title}</Text><Text style={[styles.rowDetail, { color: theme.secondaryLabel }]} numberOfLines={2}>{detail}</Text></View><ChevronRight size={18} color={theme.secondaryLabel} /></Pressable>;
}

export default function WebCloudPlanning() {
  const theme = useTheme();
  const [entities, setEntities] = useState<CloudEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await loadCloudBootstrap(["budget_plans", "goals", "savings_rules", "recurring_transactions", "transactions", "categories", "accounts"]);
      setEntities(result.entities.filter((entity) => entity.payload !== null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de charger la planification cloud.");
    } finally { setLoading(false); }
  }, []);

  // The first remote load intentionally synchronizes component state after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const plans = useMemo(() => entities.filter((entity) => ["budget_plans", "goals", "savings_rules", "recurring_transactions"].includes(entity.entityType)), [entities]);
  const goals = plans.filter((entity) => entity.entityType === "goals");
  const budgets = plans.filter((entity) => entity.entityType === "budget_plans");
  const savings = plans.filter((entity) => entity.entityType === "savings_rules");
  const recurring = plans.filter((entity) => entity.entityType === "recurring_transactions");
  const reserved = goals.reduce((sum, goal) => sum + numberField(goal, "reserved_amount"), 0);
  const [now] = useState(() => Date.now());
  const pending = recurring.filter((item) => numberField(item, "next_date") > 0 && numberField(item, "next_date") < now).length;

  const section = (type: PlanningType, items: CloudEntity[], actionLabel: string) => <View style={styles.section}><View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: theme.label }]}>{TYPE_LABELS[type]}</Text><Text style={[styles.sectionHint, { color: theme.secondaryLabel }]}>{items.length > 0 ? `${items.length} élément${items.length > 1 ? "s" : ""}` : "Aucun élément pour le moment"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={() => router.push({ pathname: "/app/planning/new" as never, params: { type } })} style={({ pressed }) => [styles.addLink, pressed && styles.pressed]}><Plus size={16} color={theme.accent} /><Text style={{ color: theme.accent, fontWeight: "800" }}>Ajouter</Text></Pressable></View>{items.length > 0 ? <View style={[styles.list, { borderColor: theme.separator }]}>{items.map((entity) => <PlanRow key={entity.entityId} entity={entity} type={type} onPress={() => router.push({ pathname: "/app/planning/new" as never, params: { type, id: entity.entityId } })} />)}</View> : <View style={[styles.emptySection, { backgroundColor: theme.surface, borderColor: theme.separator }]}><Text style={[styles.emptyText, { color: theme.secondaryLabel }]}>{emptyAction(type)}</Text><ActionButton label={actionLabel} onPress={() => router.push({ pathname: "/app/planning/new" as never, params: { type } })} /></View>}</View>;

  if (loading) return <View style={[styles.state, { backgroundColor: theme.background }]}><Text style={[styles.stateTitle, { color: theme.label }]}>Chargement de votre planification…</Text></View>;
  if (error) return <View style={[styles.state, { backgroundColor: theme.background }]}><InlineError message={error} onRetry={() => void load()} /></View>;

  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}><View style={styles.heading}><View><Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>ESPACE CLOUD · PLANIFICATION</Text><Text style={[styles.title, { color: theme.label }]}>Planification</Text><Text style={[styles.lead, { color: theme.secondaryLabel }]}>Préparez les prochaines décisions sans perdre de vue ce qui reste disponible.</Text></View><View style={styles.headingAction}><ActionButton label="Actualiser" variant="secondary" onPress={() => void load()} /></View></View><View style={[styles.snapshot, { backgroundColor: theme.accentSurface }]}><Text style={{ color: theme.accentSurfaceLabel, fontWeight: "800", letterSpacing: 0.8 }}>ENGAGEMENTS ACTIFS</Text><Text style={[styles.snapshotValue, { color: theme.accentSurfaceText }]}>{plans.length}</Text><Text style={{ color: theme.accentSurfaceLabel }}>éléments qui donnent une direction à votre argent</Text><View style={styles.snapshotFooter}><Text style={{ color: theme.accentSurfaceIncome }}>{goals.length > 0 ? `${formatAmount(reserved, "XOF")} déjà réservé` : "Aucun objectif actif"}</Text><Text style={{ color: pending > 0 ? theme.accentSurfaceExpense : theme.accentSurfaceLabel }}>{pending > 0 ? `${pending} échéance${pending > 1 ? "s" : ""} à valider` : "Échéances à jour"}</Text></View></View>{section("budget_plans", budgets, "Créer un budget")}{section("goals", goals, "Créer un objectif")}{section("savings_rules", savings, "Créer une règle")}{section("recurring_transactions", recurring, "Créer une récurrence")}<View style={styles.section}><View style={styles.sectionHeader}><View><Text style={[styles.sectionTitle, { color: theme.label }]}>À consulter</Text><Text style={[styles.sectionHint, { color: theme.secondaryLabel }]}>Les outils qui éclairent une décision</Text></View></View><View style={[styles.list, { borderColor: theme.separator }]}><LinkRow icon={Target} title="Dépenses sûres" detail="Voyez ce qui reste engageable avec les données cloud." onPress={() => router.push("/app/cashflow" as never)} /><LinkRow icon={BarChart3} title="Analyses" detail="Comparez les périodes et les catégories." onPress={() => router.push("/app/statistics")} /><LinkRow icon={CalendarClock} title="Calendrier" detail="Vérifiez le premier jour de semaine utilisé dans les dates." onPress={() => router.push("/calendar-settings")} /></View></View></ScrollView>;
}

function LinkRow({ icon: Icon, title, detail, onPress }: { icon: typeof BarChart3; title: string; detail: string; onPress: () => void }) { const theme = useTheme(); return <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${title}. ${detail}`} style={({ pressed }) => [styles.planRow, { backgroundColor: theme.surface }, pressed && styles.pressed]}><View style={[styles.icon, { backgroundColor: withAlpha(theme.accent, "16") }]}><Icon size={19} color={theme.accent} /></View><View style={styles.copy}><Text style={[styles.rowTitle, { color: theme.label }]}>{title}</Text><Text style={[styles.rowDetail, { color: theme.secondaryLabel }]}>{detail}</Text></View><ChevronRight size={18} color={theme.secondaryLabel} /></Pressable>; }
function typeLabel(type: string): string { return type === "income" ? "Revenu" : type === "transfer" ? "Transfert" : "Dépense"; }
function frequencyLabel(value: string): string { return value === "daily" ? "Tous les jours" : value === "weekly" ? "Toutes les semaines" : value === "yearly" ? "Tous les ans" : "Tous les mois"; }
function emptyAction(type: PlanningType): string { return type === "budget_plans" ? "Fixez un plafond par catégorie pour savoir où vous en êtes." : type === "goals" ? "Donnez un montant et une date à un projet." : type === "savings_rules" ? "Mettez de côté un pourcentage de vos revenus." : "Programmez les mouvements réguliers sans les ressaisir."; }

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl }, heading: { flexDirection: "row", justifyContent: "space-between", gap: spacing.lg, flexWrap: "wrap" }, headingAction: { minWidth: 120 }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { ...typography.display }, lead: { maxWidth: 680, fontSize: 15, lineHeight: 22, marginTop: spacing.sm }, snapshot: { padding: spacing.xl, borderRadius: 24, gap: spacing.sm }, snapshotValue: { fontSize: 46, lineHeight: 50, fontWeight: "800" }, snapshotFooter: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#FFFFFF55", paddingTop: spacing.md, marginTop: spacing.md }, section: { gap: spacing.md }, sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, sectionTitle: { fontSize: 19, fontWeight: "800" }, sectionHint: { fontSize: 13, marginTop: 2 }, addLink: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, paddingHorizontal: 10 }, list: { borderWidth: 1, borderRadius: 18, overflow: "hidden" }, planRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }, icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12 }, copy: { flex: 1, gap: 3 }, rowTitle: { fontSize: 15, fontWeight: "800" }, rowDetail: { fontSize: 13, lineHeight: 19 }, emptySection: { alignItems: "flex-start", gap: spacing.md, padding: spacing.xl, borderWidth: 1, borderRadius: 18 }, emptyText: { maxWidth: 600, fontSize: 14, lineHeight: 21 }, state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }, stateTitle: { fontSize: 18, fontWeight: "700" }, pressed: { opacity: 0.68 },
});
