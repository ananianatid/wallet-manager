import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  Info,
  Lock,
  PiggyBank,
  RefreshCcw,
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
import { radius, spacing, useTheme } from "@/theme";
import { formatDate } from "@/utils/format";

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
    | "/currency-settings"
    | "/(tabs)/(settings)/accounts-settings";
  section: "Organisation" | "Planification" | "Sécurité" | "Préférences";
}[] = [
  { label: "Comptes", icon: Wallet, href: "/(tabs)/(settings)/accounts-settings", section: "Organisation" },
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
  { label: "À propos", icon: Info, href: "/about", section: "Préférences" },
];

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : "Une erreur est survenue.";

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
      setImportError(errorMessage(error));
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
      setImportError(errorMessage(e));
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
      Alert.alert("Impossible d'ouvrir le fichier", errorMessage(e));
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg }}
    >
      <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg }}>
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
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
            >
              <View style={{ width: 24 }}><entry.icon size={22} strokeWidth={2} color={theme.accent} /></View>
              <Text style={[styles.label, { color: theme.label }]}>{entry.label}</Text>
              <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13, fontWeight: "600" }}>DONNÉES</Text>
        <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: theme.label, fontWeight: "600" }}>Sauvegarde chiffrée</Text>
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

        <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
          {importError ? <InlineError message={importError} onRetry={() => setImportStatus("idle")} /> : null}
          <Text style={{ color: theme.label, fontWeight: "600" }}>Importer Money Manager</Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Restaure les comptes, catégories et transactions depuis un fichier .mmbak (export complet de l’app Money Manager).
          </Text>
          <ActionButton
            onPress={pickAndImport}
            disabled={importing}
            label={importStatus === "reading" ? "Lecture…" : importStatus === "confirming" ? "Confirmation…" : importStatus === "applying" ? "Import en cours…" : "Choisir un fichier .mmbak"}
          />
          {importReport ? <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 18 }}>Dernier import : {importReport.transactionsInserted} transactions ajoutées, {importReport.transactionsSkipped} doublons ignorés.</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "600", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg },
  label: { flex: 1, fontWeight: "600" },
});
