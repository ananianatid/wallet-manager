import { Stack } from "expo-router/stack";
import { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActionButton, ScreenState } from "@/components/ui";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { runDiagnostics, type DiagnosticReport } from "@/utils/diagnostics";
import { radius, spacing, useTheme } from "@/theme";
import { userMessage } from "@/utils/user-message";

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  warn: "À surveiller",
  fail: "Échec",
};

export default function DiagnosticsScreen() {
  const theme = useTheme();
  const load = useCallback(() => runDiagnostics(), []);
  const resource = useAsyncResource<DiagnosticReport>(load, "diagnostics.load");

  if (resource.status === "error" || resource.status === "loading") {
    return (
      <>
        <Stack.Screen options={{ title: "Diagnostics" }} />
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={userMessage(resource.error, "Les diagnostics n'ont pas pu être chargés.")}
          onRetry={() => void resource.reload()}
        />
      </>
    );
  }

  const report = resource.data;
  if (!report) {
    return null;
  }
  const statusColor = (status: string) =>
    status === "ok" ? theme.income : status === "fail" ? theme.expense : theme.secondaryLabel;

  return (
    <>
      <Stack.Screen options={{ title: "Diagnostics" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.label }]}>État des services</Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Wallet v{report.appVersion} · {new Date(report.ranAt).toLocaleString("fr-FR")}
          </Text>
          {report.items.map((entry) => (
            <View key={entry.id} style={styles.itemRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(entry.status) }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: theme.label, fontWeight: "600" }}>{entry.label}</Text>
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>{entry.detail}</Text>
              </View>
              <Text style={{ color: statusColor(entry.status), fontWeight: "700", fontSize: 13 }}>
                {STATUS_LABEL[entry.status]}
              </Text>
            </View>
          ))}
          <ActionButton label="Relancer la vérification" onPress={() => void resource.reload()} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.cardTitle, { color: theme.label }]}>Journal récent</Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Les {report.logs.length} dernières entrées (session {report.sessionId.slice(0, 8)}…)
          </Text>
          <Text
            selectable
            style={{
              color: theme.secondaryLabel,
              fontSize: 12,
              lineHeight: 17,
              fontFamily: "monospace",
            }}
          >
            {report.logs.length === 0
              ? "Aucune entrée."
              : report.logs
                  .map(
                    (entry) =>
                      `${entry.ts} [${entry.level.toUpperCase()}] ${entry.context}: ${entry.message}`,
                  )
                  .join("\n")}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
