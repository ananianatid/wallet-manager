import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  Database,
  Info,
  Lock,
  PiggyBank,
  RefreshCcw,
  ShieldCheck,
  Sun,
  Target,
  Wallet,
} from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography, useTheme, withAlpha } from "@/theme";

const ENTRIES: {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  href:
    | "/categories/income"
    | "/categories/expense"
    | "/budgets"
    | "/savings"
    | "/recurring"
    | "/goals"
    | "/security"
    | "/data-management"
    | "/appearance"
    | "/calendar-settings"
    | "/about"
    | "/privacy-policy"
    | "/currency-settings"
    | "/diagnostics"
    | "/cloud-account";
  section: "Organisation" | "Planification" | "Sécurité" | "Données" | "Préférences";
}[] = [
  { label: "Catégories de revenus", icon: ArrowUp, href: "/categories/income", section: "Organisation" },
  { label: "Catégories de dépenses", icon: ArrowDown, href: "/categories/expense", section: "Organisation" },
  { label: "Budgets", icon: Target, href: "/budgets", section: "Planification" },
  { label: "Épargne", icon: PiggyBank, href: "/savings", section: "Planification" },
  { label: "Transactions récurrentes", icon: RefreshCcw, href: "/recurring", section: "Planification" },
  { label: "Objectifs", icon: Target, href: "/goals", section: "Planification" },
  { label: "Sécurité", icon: Lock, href: "/security", section: "Sécurité" },
  { label: "Données", icon: Database, href: "/data-management", section: "Données" },
  { label: "Apparence", icon: Sun, href: "/appearance", section: "Préférences" },
  { label: "Calendrier", icon: CalendarDays, href: "/calendar-settings", section: "Préférences" },
  { label: "Devises", icon: Wallet, href: "/currency-settings", section: "Préférences" },
  { label: "Confidentialité", icon: ShieldCheck, href: "/privacy-policy", section: "Préférences" },
  { label: "Compte et synchronisation", icon: RefreshCcw, href: "/cloud-account", section: "Préférences" },
  { label: "À propos", icon: Info, href: "/about", section: "Préférences" },
  { label: "Diagnostics", icon: Activity, href: "/diagnostics", section: "Préférences" },
];

export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl }}
    >
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={[styles.introTitle, { color: theme.label }]}>Réglages</Text>
        <Text style={[styles.introText, { color: theme.secondaryLabel }]}>Les outils pour organiser, protéger et comprendre vos données.</Text>
      </View>
      <View style={[styles.menu, { backgroundColor: theme.surface }]}>
        {ENTRIES.map((entry, index) => (
          <View key={entry.href}>
            {index === 0 || ENTRIES[index - 1].section !== entry.section ? (
              <Text style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>{entry.section}</Text>
            ) : (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: spacing.lg }} />
            )}
            <Pressable
              onPress={() => router.push(entry.href as never)}
              accessibilityRole="button"
              accessibilityLabel={entry.label}
              accessibilityHint={`Ouvrir ${entry.label.toLowerCase()}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.entryIcon, { backgroundColor: withAlpha(theme.accent, "16") }]}>
                <entry.icon size={19} strokeWidth={2.1} color={theme.accent} />
              </View>
              <Text style={[styles.label, { color: theme.label }]}>{entry.label}</Text>
              <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  introTitle: { ...typography.display },
  introText: { ...typography.body },
  menu: { borderRadius: radius.xl, overflow: "hidden" },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg },
  entryIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  label: { flex: 1, fontWeight: "600" },
  pressed: { opacity: 0.6 },
});
