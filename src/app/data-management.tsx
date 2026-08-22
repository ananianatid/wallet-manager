import { Stack, router, useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { exportPlainBackup, type ExportedBackup } from "@/backup/export";
import { applyLocalMoneyManagerImport, loadLastBackupDate, readMoneyManagerBackup, type ImportPlan, type ImportReport } from "@/data/data-management";
import { ActionButton, InlineError } from "@/components/ui";
import { formatDate } from "@/utils/format";
import { log } from "@/utils/logger";
import { technicalErrorMessage, userMessage } from "@/utils/user-message";
import { radius, spacing, typography, useTheme, withAlpha } from "@/theme";
import { useCloudAuth } from "@/cloud/auth-context";
import { useSyncStatus, formatLastSyncedAt } from "@/cloud/sync-status";

type ImportStatus = "idle" | "reading" | "confirming" | "applying" | "success" | "error";

function exportReadyMessage(result: ExportedBackup): string {
  if (result.shared) {
    return `Le fichier « ${result.name} » est prêt. Le menu de partage a été ouvert.`;
  }
  return `Le fichier « ${result.name} » a été créé dans les documents de Wallet. Le menu de partage n'a pas pu être ouvert.`;
}

export default function DataManagementScreen() {
  const theme = useTheme();
  const { status, user, syncNow } = useCloudAuth();
  const sync = useSyncStatus();
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [plainExportBusy, setPlainExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const importing = importStatus === "reading" || importStatus === "confirming" || importStatus === "applying";

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadLastBackupDate()
        .then((value) => {
          if (!cancelled) setLastBackup(value == null ? null : Number(value));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const runPlainExport = async () => {
    setPlainExportBusy(true);
    setExportError(null);
    try {
      const result = await exportPlainBackup();
      setLastBackup(Date.now());
      Alert.alert("Sauvegarde créée", exportReadyMessage(result));
    } catch (error) {
      setExportError(technicalErrorMessage(error));
      log.error("data.export.plain", "Échec de l'export sans chiffrement", error);
    } finally {
      setPlainExportBusy(false);
    }
  };

  const confirmPlainExport = () => {
    if (plainExportBusy) return;
    Alert.alert(
      "Exporter sans chiffrement ?",
      "Le fichier SQLite contiendra toutes vos données en clair. Toute personne qui y accède pourra les lire. Utilisez cette option uniquement pour un transfert temporaire ou dans un emplacement de confiance.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Exporter sans chiffrement", style: "destructive", onPress: () => void runPlainExport() },
      ],
    );
  };

  const pickAndRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled || result.assets.length === 0) return;
      router.push({ pathname: "/backup-restore", params: { uri: result.assets[0].uri } });
    } catch (error) {
      Alert.alert("Impossible d'ouvrir le fichier", userMessage(error));
      log.error("data.restore", "Échec de l'ouverture du fichier de sauvegarde", error);
    }
  };

  const applyPlan = async (plan: ImportPlan) => {
    setImportStatus("applying");
    setImportError(null);
    try {
      const report = await applyLocalMoneyManagerImport(plan);
      setImportReport(report);
      setImportStatus("success");
      Alert.alert(
        "Import terminé",
        `${report.transactionsInserted} transactions ajoutées\n${report.transactionsSkipped} doublons ignorés\n${report.categoriesAdded} catégories créées\n${report.categoriesRemoved} catégories retirées\n${report.accountsCreated} comptes créés`,
      );
    } catch (error) {
      setImportStatus("error");
      setImportError(userMessage(error));
      log.error("data.import.money-manager", "Échec de l'application du plan d'import", error);
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
    } catch (error) {
      setImportStatus("error");
      setImportError(userMessage(error));
      log.error("data.import.money-manager", "Échec de la lecture du fichier Money Manager", error);
    }
  };

  const handleSync = async () => {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncError(null);
    setSyncMessage(null);
    sync.setSyncing(true);
    try {
      const result = await syncNow();
      await sync.markSynced(result.cursor);
      await sync.refresh();
      setSyncMessage(result.conflicts.length > 0 ? `${result.conflicts.length} conflit(s) à résoudre.` : `${result.pushed} envoyé(s), ${result.pulled} reçu(s).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Synchronisation impossible.";
      setSyncError(msg);
      await sync.markError(msg);
      Alert.alert("Synchronisation impossible", msg);
    } finally {
      sync.setSyncing(false);
      setSyncBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Données" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.label }]}>Données</Text>
          <Text style={[styles.description, { color: theme.secondaryLabel }]}>Exportez, restaurez, importez ou synchronisez vos données.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator, borderWidth: StyleSheet.hairlineWidth }]}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.label }]}>Synchronisation cloud</Text>
          {status === "guest" ? (
            <>
              <Text style={[styles.cardText, { color: theme.secondaryLabel }]}>Vous êtes en mode local. Activez la synchronisation pour retrouver vos données sur votre téléphone et votre PC.</Text>
              <ActionButton label="Activer la synchronisation" onPress={() => router.push("/cloud-account")} />
            </>
          ) : user && !user.emailVerified ? (
            <>
              <Text style={[styles.cardText, { color: theme.secondaryLabel }]}>Compte {user.email} — vérifiez votre adresse email pour activer la synchronisation.</Text>
              <InlineError message="Vérification requise. Consultez vos emails." />
              <ActionButton label="Gérer le compte" variant="secondary" onPress={() => router.push("/cloud-account")} />
            </>
          ) : (
            <>
              <Text style={[styles.cardText, { color: theme.secondaryLabel }]}>
                Compte {user?.email ?? ""} · {formatLastSyncedAt(sync.lastSyncedAt) ? `Dernière sync ${formatLastSyncedAt(sync.lastSyncedAt)}` : "Jamais synchronisé"}
              </Text>
              <View style={[styles.syncStats, { backgroundColor: theme.surfaceElevated, borderColor: theme.separator }]}>
                <View style={styles.syncStat}>
                  <Text style={[styles.syncStatLabel, { color: theme.secondaryLabel }]}>En attente</Text>
                  <Text style={[styles.syncStatValue, { color: sync.pending > 0 ? theme.warning : theme.label }]}>{sync.pending}</Text>
                </View>
                <View style={[styles.syncStatDivider, { backgroundColor: theme.separator }]} />
                <View style={styles.syncStat}>
                  <Text style={[styles.syncStatLabel, { color: theme.secondaryLabel }]}>Conflits</Text>
                  <Text style={[styles.syncStatValue, { color: sync.conflicts > 0 ? theme.expense : theme.label }]}>{sync.conflicts}</Text>
                </View>
                <View style={[styles.syncStatDivider, { backgroundColor: theme.separator }]} />
                <View style={styles.syncStat}>
                  <Text style={[styles.syncStatLabel, { color: theme.secondaryLabel }]}>État</Text>
                  <Text style={[styles.syncStatValue, { color: sync.kind === "synced" ? theme.income : sync.kind === "error" ? theme.expense : theme.label }]}>
                    {sync.kind === "synced" ? "À jour" : sync.kind === "syncing" ? "Sync…" : sync.kind === "offline" ? "Hors ligne" : sync.kind === "conflicts" ? "Conflits" : sync.kind === "error" ? "Erreur" : "Local"}
                  </Text>
                </View>
              </View>
              {sync.error ? <InlineError message={sync.error} /> : null}
              {syncError ? <InlineError message={syncError} onRetry={() => void handleSync()} /> : null}
              {syncMessage ? <Text style={[styles.successText, { color: theme.income }]}>{syncMessage}</Text> : null}
              <ActionButton label={syncBusy || sync.isSyncing ? "Synchronisation…" : "Synchroniser maintenant"} onPress={() => void handleSync()} disabled={syncBusy || sync.isSyncing} />
              {sync.conflicts > 0 ? <ActionButton label="Voir les conflits" variant="secondary" onPress={() => router.push("/sync-conflicts")} /> : null}
              <ActionButton label="Gérer le compte et les appareils" variant="secondary" onPress={() => router.push("/cloud-account")} />
            </>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.label }]}>Sauvegardes</Text>
          <Text style={[styles.cardText, { color: theme.secondaryLabel }]}>La sauvegarde chiffrée est recommandée pour conserver vos données. Vous pouvez aussi produire une copie SQLite pour un transfert local.</Text>
          {lastBackup != null ? <Text style={[styles.meta, { color: theme.secondaryLabel }]}>Dernière sauvegarde : {formatDate(lastBackup)}</Text> : null}
          {exportError ? <InlineError message={exportError} /> : null}
          <ActionButton label="Exporter une sauvegarde chiffrée" onPress={() => router.push("/backup-export")} />
          <View style={[styles.warningBox, { backgroundColor: withAlpha(theme.expense, "12") }]}>
            <Text style={[styles.warningTitle, { color: theme.expense }]}>Copie non chiffrée</Text>
            <Text style={[styles.warningText, { color: theme.secondaryLabel }]}>Le fichier .wldb sera lisible par toute personne qui le récupère.</Text>
            <ActionButton
              label={plainExportBusy ? "Export en cours…" : "Exporter sans chiffrement"}
              variant="destructive"
              onPress={confirmPlainExport}
              disabled={plainExportBusy}
            />
          </View>
          <ActionButton label="Restaurer une sauvegarde" variant="secondary" onPress={() => void pickAndRestore()} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {importError ? <InlineError message={importError} onRetry={() => setImportStatus("idle")} /> : null}
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.label }]}>Importer des données</Text>
          <Text style={[styles.cardText, { color: theme.secondaryLabel }]}>Restaurez un export complet de Money Manager ou ajoutez des transactions depuis un fichier CSV.</Text>
          <ActionButton
            onPress={() => void pickAndImport()}
            disabled={importing}
            label={importStatus === "reading" ? "Lecture…" : importStatus === "confirming" ? "Confirmation…" : importStatus === "applying" ? "Import en cours…" : "Choisir un fichier Money Manager"}
          />
          <ActionButton label="Importer un fichier CSV" variant="secondary" onPress={() => router.push("/import-csv")} />
          {importReport ? <Text accessibilityRole="summary" style={[styles.successText, { color: theme.income }]}>Dernier import : {importReport.transactionsInserted} transactions ajoutées, {importReport.transactionsSkipped} doublons ignorés.</Text> : null}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg, flexGrow: 1 },
  intro: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  title: { ...typography.title },
  description: { ...typography.body },
  card: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  cardTitle: { ...typography.section },
  cardText: { fontSize: 13, lineHeight: 18 },
  meta: { fontSize: 13, lineHeight: 18 },
  warningBox: { borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  warningTitle: { fontSize: 13, fontWeight: "700" },
  warningText: { fontSize: 13, lineHeight: 18 },
  successText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  syncStats: { flexDirection: "row", borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.md },
  syncStat: { flex: 1, alignItems: "center", gap: 4 },
  syncStatLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3, textTransform: "uppercase" },
  syncStatValue: { fontSize: 16, fontWeight: "800" },
  syncStatDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
});
