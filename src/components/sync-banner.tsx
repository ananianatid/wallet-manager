import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react-native";
import { router } from "expo-router";
import { spacing, useTheme, withAlpha, radius } from "@/theme";
import { useSyncStatus, formatLastSyncedAt } from "@/cloud/sync-status";
import { useCloudAuth } from "@/cloud/auth-context";
import { useState } from "react";

export function SyncBanner({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const { status, user } = useCloudAuth();
  const sync = useSyncStatus();
  const [busy, setBusy] = useState(false);

  // Email not verified banner has priority
  if (status === "authenticated" && user && !user.emailVerified) {
    return (
      <View
        accessibilityRole="alert"
        accessibilityLabel="Vérification email requise pour synchroniser"
        style={[styles.card, { backgroundColor: withAlpha(theme.warning, "18"), borderColor: withAlpha(theme.warning, "30") }]}
      >
        <View style={styles.row}>
          <AlertTriangle size={18} color={theme.warning} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.label }]}>Vérifiez votre adresse email</Text>
            <Text style={[styles.body, { color: theme.secondaryLabel }]}>
              La synchronisation est en pause tant que l’adresse n’est pas vérifiée.
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/cloud-account")}
          accessibilityRole="button"
          accessibilityLabel="Aller à la synchronisation"
          style={({ pressed }) => [styles.action, { backgroundColor: theme.surface }, pressed && styles.pressed]}
        >
          <Text style={[styles.actionLabel, { color: theme.label }]}>Vérifier</Text>
        </Pressable>
      </View>
    );
  }

  if (!sync.isCloudEnabled) return null;

  if (sync.kind === "conflicts") {
    return (
      <View
        accessibilityRole="alert"
        style={[styles.card, { backgroundColor: withAlpha(theme.expense, "14"), borderColor: withAlpha(theme.expense, "22") }]}
      >
        <View style={styles.row}>
          <AlertTriangle size={18} color={theme.expense} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.label }]}>
              {sync.conflicts} conflit{sync.conflicts > 1 ? "s" : ""} à résoudre
            </Text>
            <Text style={[styles.body, { color: theme.secondaryLabel }]}>
              Wallet a gardé vos deux versions. Choisissez laquelle conserver.
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/sync-conflicts")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, { backgroundColor: theme.surface }, pressed && styles.pressed]}
        >
          <Text style={[styles.actionLabel, { color: theme.expense }]}>Résoudre</Text>
        </Pressable>
      </View>
    );
  }

  if (sync.kind === "syncing") {
    const progress = sync.progress.total > 0 ? Math.round((sync.progress.completed / sync.progress.total) * 100) : null;
    return (
      <View style={[styles.card, styles.syncingCard, { backgroundColor: withAlpha(theme.accent, "10"), borderColor: withAlpha(theme.accent, "18") }]}>
        <View style={styles.syncingHeader}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={[styles.body, styles.syncingMessage, { color: theme.secondaryLabel }]}>{sync.progress.message || "Synchronisation en cours…"}</Text>
          {compact ? null : <Text style={[styles.meta, { color: theme.secondaryLabel }]}>{progress == null ? "…" : `${progress}%`}</Text>}
        </View>
        {!compact ? <View accessibilityRole="progressbar" accessibilityLabel="Progression de la synchronisation" accessibilityValue={progress == null ? undefined : { min: 0, max: 100, now: progress }} style={[styles.progressTrack, { backgroundColor: withAlpha(theme.accent, "20") }]}>
          {progress == null ? null : <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.accent }]} />}
        </View> : null}
      </View>
    );
  }

  if (sync.kind === "error") {
    return (
      <View style={[styles.card, { backgroundColor: withAlpha(theme.expense, "12"), borderColor: withAlpha(theme.expense, "20") }]}>
        <View style={styles.row}>
          <CloudOff size={18} color={theme.expense} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.label }]}>Synchronisation interrompue</Text>
            <Text numberOfLines={2} style={[styles.body, { color: theme.secondaryLabel }]}>{sync.error ?? "Connexion indisponible."}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/cloud-account")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, { backgroundColor: theme.surface }, pressed && styles.pressed]}
        >
          <Text style={[styles.actionLabel, { color: theme.label }]}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  if (sync.kind === "offline" && sync.pending > 0) {
    const label = formatLastSyncedAt(sync.lastSyncedAt);
    return (
      <View style={[styles.card, { backgroundColor: withAlpha(theme.warning, "14"), borderColor: withAlpha(theme.warning, "24") }]}>
        <View style={styles.row}>
          <CloudOff size={18} color={theme.warning} />
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.label }]}>
              {sync.pending} modification{sync.pending > 1 ? "s" : ""} en attente
            </Text>
            <Text style={[styles.body, { color: theme.secondaryLabel }]}>
              {label ? `Dernière sync ${label} · Sera envoyé dès le retour réseau.` : "Sera synchronisé dès le retour réseau."}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={async () => {
            if (busy) return;
            setBusy(true);
            sync.setSyncing(true);
            try {
              const dbMod = await import("@/db/database");
              const syncMod = await import("@/cloud/sync");
              const db = await dbMod.getDatabase();
              const result = await syncMod.runSync(db);
              await sync.markSynced(result.cursor);
            } catch (e) {
              await sync.markError(e instanceof Error ? e.message : "Échec de synchronisation.");
            } finally {
              sync.setSyncing(false);
              setBusy(false);
              void sync.refresh();
            }
          }}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, { backgroundColor: theme.surface, opacity: busy ? 0.6 : 1 }, pressed && styles.pressed]}
        >
          {busy ? <ActivityIndicator size="small" color={theme.label} /> : <RefreshCw size={16} color={theme.label} />}
          <Text style={[styles.actionLabel, { color: theme.label }]}>{busy ? "Sync…" : "Synchroniser"}</Text>
        </Pressable>
      </View>
    );
  }

  // synced - show nothing unless compact wants a subtle line (we keep quiet)
  if (compact) return null;
  // Optional subtle synced line - hidden to keep calm UI
  return null;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
  },
  syncingCard: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  syncingHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, width: "100%" },
  syncingMessage: { flex: 1 },
  progressTrack: { height: 5, width: "100%", overflow: "hidden", borderRadius: 99 },
  progressFill: { height: "100%", borderRadius: 99 },
  row: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  body: { fontSize: 12, lineHeight: 17 },
  meta: { fontSize: 11, marginLeft: "auto" },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
  actionLabel: { fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
