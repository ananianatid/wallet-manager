import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Info,
  Sun,
  Wallet,
} from "lucide-react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getDatabase } from "@/db/database";
import { applyImportPlan, readMoneyManagerBackup } from "@/db/import";
import { radius, spacing, useTheme } from "@/theme";
import { formatDate } from "@/utils/format";

const ENTRIES: {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  href:
    | "/categories/income"
    | "/categories/expense"
    | "/categories/account"
    | "/appearance"
    | "/about";
}[] = [
  { label: "Catégories de revenus", icon: ArrowUp, href: "/categories/income" },
  { label: "Catégories de dépenses", icon: ArrowDown, href: "/categories/expense" },
  { label: "Catégories de comptes", icon: Wallet, href: "/categories/account" },
  { label: "Apparence", icon: Sun, href: "/appearance" },
  { label: "À propos", icon: Info, href: "/about" },
];

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : "Une erreur est survenue.";

export default function SettingsScreen() {
  const theme = useTheme();
  const [importing, setImporting] = useState(false);

  const pickAndImport = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) {
      return;
    }
    const asset = result.assets[0];
    setImporting(true);
    try {
      const { plan, name } = await readMoneyManagerBackup(
        asset.uri,
        asset.name,
      );
      const { stats } = plan;
      const period =
        stats.rangeStart != null && stats.rangeEnd != null
          ? `${formatDate(stats.rangeStart)} → ${formatDate(stats.rangeEnd)}`
          : "—";
      Alert.alert(
        "Importer Money Manager",
        `« ${name} »\n\n${stats.income} revenus\n${stats.expense} dépenses\n${stats.transfer} transferts\n${stats.accounts} comptes, ${stats.categories} catégories\nPériode : ${period}\n\nLes catégories par défaut seront remplacées par celles du fichier.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Importer",
            onPress: () => {
              getDatabase()
                .then(async (db) => {
                  const report = await applyImportPlan(db, plan);
                  Alert.alert(
                    "Import terminé",
                    `${report.transactionsInserted} transactions ajoutées\n${report.transactionsSkipped} doublons ignorés\n${report.categoriesAdded} catégories créées\n${report.accountsCreated} comptes créés`,
                  );
                })
                .catch((e) => {
                  Alert.alert("Import impossible", errorMessage(e));
                });
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert("Import impossible", errorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: radius.lg,
        }}
      >
        {ENTRIES.map((entry, index) => (
          <View key={entry.href}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.separator,
                  marginLeft: spacing.lg,
                }}
              />
            ) : null}
            <Pressable
              onPress={() => router.push(entry.href)}
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.6 },
              ]}
            >
              <View style={{ width: 24 }}>
                <entry.icon size={22} strokeWidth={2} color={theme.accent} />
              </View>
              <Text style={[styles.label, { color: theme.label }]}>
                {entry.label}
              </Text>
              <ChevronRight size={18} strokeWidth={2} color={theme.secondaryLabel} />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text
          style={{
            color: theme.secondaryLabel,
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          DONNÉES
        </Text>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <Text style={{ color: theme.label, fontWeight: "600" }}>
            Importer Money Manager
          </Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Restaure les comptes, catégories et transactions depuis un fichier
            .mmbak (export complet de l’app Money Manager).
          </Text>
          <Pressable
            onPress={pickAndImport}
            disabled={importing}
            style={({ pressed }) => [
              styles.importButton,
              { backgroundColor: theme.accent },
              pressed && { opacity: 0.7 },
              importing && { opacity: 0.5 },
            ]}
          >
            <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>
              {importing ? "Lecture…" : "Choisir un fichier .mmbak"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  label: {
    flex: 1,
    fontWeight: "600",
  },
  importButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
});
