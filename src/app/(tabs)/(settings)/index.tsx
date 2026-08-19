import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  Info,
  Lock,
  PiggyBank,
  RefreshCcw,
  ShieldCheck,
  Sun,
  Target,
  Wallet,
} from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getDatabase } from "@/db/database";
import { getSetting } from "@/db/settings";
import { applyImportPlan, readMoneyManagerBackup, type ImportReport } from "@/db/import";
import type { ImportPlan } from "@/db/money-manager";
import { ActionButton, InlineError } from "@/components/ui";
import { radius, spacing, typography, useTheme, withAlpha } from "@/theme";
import { formatDate } from "@/utils/format";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

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
    | "/appearance"
    | "/calendar-settings"
    | "/about"
    | "/privacy-policy"
    | "/currency-settings"
    | "/diagnostics";
  section: "Organisation" | "Planification" | "Sécurité" | "Préférences";
}[] = [
  { label: "Catégories de revenus", icon: ArrowUp, href: "/categories/income", section: "Organisation" },
  { label: "Catégories de dépenses", icon: ArrowDown, href: "/categories/expense", section: "Organisation" },
  { label: "Budgets", icon: Target, href: "/budgets", section: "Planification" },
  { label: "Épargne", icon: PiggyBank, href: "/savings", section: "Planification" },
  { label: "Transactions récurrentes", icon: RefreshCcw, href: "/recurring", section: "Planification" },
  { label: "Objectifs", icon: Target, href: "/goals", section: "Planification" },
  { label: "Sécurité", icon: Lock, href: "/security", section: "Sécurité" },
  { label: "Apparence", icon: Sun, href: "/appearance", section: "Préférences" },
  { label: "Calendrier", icon: CalendarDays, href: "/calendar-settings", section: "Préférences" },
  { label: "Devises", icon: Wallet, href: "/currency-settings", section: "Préférences" },
  { label: "Confidentialité", icon: ShieldCheck, href: "/privacy-policy", section: "Préférences" },
  { label: "À propos", icon: Info, href: "/about", section: "Préférences" },
  { label: "Diagnostics", icon: Activity, href: "/diagnostics", section: "Préférences" },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const [importStatus, setImportStatus] = useState<"idle" | "reading" | "confirming" | "applying" | "success" | "error">("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const importing = importStatus === "reading" || importStatus === "confirming" || importStatus === "applying";

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getDatabase()
        .then((db) => getSetting(db, "backup_last_date"))
        .then((value) => {
          if (!cancelled && value != null) {
            setLastBackup(Number(value));
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const applyPlan = async (plan: ImportPlan) => {
    setImportStatus("applying");
    setImportError(null);
    try {
      const db = await getDatabase();
      const report = await applyImportPlan(db, plan);
      setImportReport(report);
      setImportStatus("success");
      Alert.alert(
        "Import terminé",
        `${report.transactionsInserted} transactions ajoutées\n${report.transactionsSkipped} doublons ignorés\n${report.categoriesAdded} catégories créées\n${report.categoriesRemoved} catégories retirées\n${report.accountsCreated} comptes créés`,
      );
    } catch (error) {
      setImportStatus("error");
      setImportError(userMessage(error));
      log.error("settings.import", "Échec de l'application du plan d'import", error);
    }
  };

  const pickAndImport = async () => {
    setImportStatus("reading");
    setImportError(null);
    setImportReport(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled || result.assets.length === 0) {
        setImportStatus("idle");
        return;
      }
      const asset = result.assets[0];
      const { plan, name } = await readMoneyManagerBackup(asset.uri, asset.name);
      const { stats } = plan;
      const period = stats.rangeStart != null && stats.rangeEnd != null
        ? `${formatDate(stats.rangeStart)} → ${formatDate(stats.rangeEnd)}`
        : "—";
      setImportStatus("confirming");
      Alert.alert(
        "Importer Money Manager",
        `« ${name} »\n\n${stats.income} revenus\n${stats.expense} dépenses\n${stats.transfer} transferts\n${stats.accounts} comptes, ${stats.categories} catégories\nPériode : ${period}\n\nLes catégories par défaut seront remplacées par celles du fichier.`,
        [
          { text: "Annuler", style: "cancel", onPress: () => setImportStatus("idle") },
          { text: "Importer", onPress: () => void applyPlan(plan) },
        ],
      );
    } catch (e) {
      setImportStatus("error");
      setImportError(userMessage(e));
      log.error("settings.import", "Échec de la lecture du fichier Money Manager", e);
    }
  };

  const pickAndRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      router.push({ pathname: "/backup-restore", params: { uri: asset.uri } });
    } catch (e) {
      Alert.alert("Impossible d'ouvrir le fichier", userMessage(e));
      log.error("settings.restore", "Échec de l'ouverture du fichier de sauvegarde", e);
    }
  };

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
            ) : index > 0 ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: spacing.lg }} />
            ) : null}
            <Pressable
              onPress={() => router.push(entry.href)}
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

      <View style={{ gap: spacing.sm }}>
        <Text
          accessibilityRole="header"
          style={{ color: theme.secondaryLabel, fontSize: 13, fontWeight: "700", letterSpacing: 0.8 }}
        >
          DONNÉES
        </Text>
        <View style={[styles.dataCard, { backgroundColor: theme.surface }]}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.label }]}>
            Sauvegarde chiffrée
          </Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Exporte toutes vos données dans un fichier protégé par mot de passe, puis restaurez-les à tout moment sur cet appareil.
          </Text>
          {lastBackup != null ? (
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
              Dernière sauvegarde : {formatDate(lastBackup)}
            </Text>
          ) : null}
          <ActionButton
            label="Exporter une sauvegarde chiffrée"
            onPress={() => router.push("/backup-export")}
            accessibilityLabel="Exporter une sauvegarde chiffrée"
          />
          <ActionButton
            label="Restaurer une sauvegarde"
            variant="secondary"
            onPress={() => void pickAndRestore()}
            accessibilityLabel="Restaurer une sauvegarde"
          />
        </View>

        <View style={[styles.dataCard, { backgroundColor: theme.surface }]}>
          {importError ? <InlineError message={importError} onRetry={() => setImportStatus("idle")} /> : null}
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.label }]}>
            Importer Money Manager
          </Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Restaure les comptes, catégories et transactions depuis un fichier .mmbak (export complet de l’app Money Manager).
          </Text>
          <ActionButton
            onPress={pickAndImport}
            disabled={importing}
            label={importStatus === "reading" ? "Lecture…" : importStatus === "confirming" ? "Confirmation…" : importStatus === "applying" ? "Import en cours…" : "Choisir un fichier .mmbak"}
          />
          {importReport ? (
            <Text
              accessibilityRole="summary"
              style={[styles.successText, { color: theme.income }]}
            >
              Dernier import : {importReport.transactionsInserted} transactions ajoutées, {importReport.transactionsSkipped} doublons ignorés.
            </Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  introTitle: { ...typography.display },
  introText: { ...typography.body },
  menu: { borderRadius: radius.xl, overflow: "hidden" },
  dataCard: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  cardTitle: { ...typography.section },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg },
  entryIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  label: { flex: 1, fontWeight: "600" },
  pressed: { opacity: 0.6 },
  successText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
});
