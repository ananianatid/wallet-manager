import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Cloud, X } from "lucide-react-native";
import { router } from "expo-router";
import { readAppSetting, writeAppSetting } from "@/data/app-settings";
import { useCloudAuth } from "@/cloud/auth-context";
import { radius, spacing, useTheme, withAlpha } from "@/theme";

export function CloudPromoCard() {
  const theme = useTheme();
  const { status } = useCloudAuth();
  const [visible, setVisible] = useState(false);

  const check = useCallback(async () => {
    if (status !== "guest") {
      setVisible(false);
      return;
    }
    try {
      const seen = await readAppSetting("cloud_welcome_seen");
      setVisible(seen !== "1");
    } catch {
      setVisible(false);
    }
  }, [status]);

  // This effect reads persisted local state when the card mounts.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);

  const dismiss = useCallback(async () => {
    try {
      await writeAppSetting("cloud_welcome_seen", "1");
    } catch {}
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Synchronisation cloud disponible"
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: withAlpha(theme.accent, "14") }]}>
        <Cloud size={20} color={theme.accent} strokeWidth={2} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.label }]}>Emportez Wallet partout</Text>
        <Text style={[styles.body, { color: theme.secondaryLabel }]}>Activez la synchronisation pour retrouver vos données sur vos appareils. Vous restez en mode local tant que vous le souhaitez.</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push("/cloud-welcome")}
            accessibilityRole="button"
            accessibilityLabel="Découvrir la synchronisation"
            style={({ pressed }) => [styles.primary, { backgroundColor: theme.accent }, pressed && styles.pressed]}
          >
            <Text style={[styles.primaryLabel, { color: theme.onAccent }]}>Activer</Text>
          </Pressable>
          <Pressable
            onPress={() => void dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Plus tard"
            style={({ pressed }) => [styles.secondary, { borderColor: theme.separator }, pressed && styles.pressed]}
          >
            <Text style={[styles.secondaryLabel, { color: theme.label }]}>Plus tard</Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={() => void dismiss()}
        accessibilityRole="button"
        accessibilityLabel="Masquer"
        hitSlop={8}
        style={styles.close}
      >
        <X size={16} color={theme.secondaryLabel} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: spacing.sm },
  title: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  body: { fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  primary: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.md, minHeight: 38, alignItems: "center", justifyContent: "center" },
  primaryLabel: { fontSize: 13, fontWeight: "700" },
  secondary: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, minHeight: 38, alignItems: "center", justifyContent: "center" },
  secondaryLabel: { fontSize: 13, fontWeight: "600" },
  close: { padding: 4, alignSelf: "flex-start" },
  pressed: { opacity: 0.7 },
});
