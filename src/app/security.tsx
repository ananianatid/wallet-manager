import { Check, Lock, LockKeyhole, ShieldCheck } from "lucide-react-native";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { ActionButton, InlineError } from "@/components/ui";
import { getBlockScreenshots, setBlockScreenshots } from "@/security/screen-capture";
import {
  LOCK_DELAY_OPTIONS_SECONDS,
  clearPinCredentials,
  setLockDelaySeconds,
  setLockEnabled,
} from "@/security/store";
import { lockNow, refreshLockConfig, useLockState } from "@/state/lock";
import { radius, spacing, useTheme } from "@/theme";

function formatDelay(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} secondes`;
  }
  if (seconds % 3600 === 0) {
    return `${seconds / 3600} h`;
  }
  return `${seconds / 60} min`;
}

export default function SecurityScreen() {
  const theme = useTheme();
  const lock = useLockState();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [blockScreenshotsEnabled, setBlockScreenshotsEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    LocalAuthentication.hasHardwareAsync()
      .then((hasHardware) =>
        hasHardware ? LocalAuthentication.isEnrolledAsync() : false,
      )
      .then(setBiometricAvailable)
      .catch(() => setBiometricAvailable(false));
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    getBlockScreenshots()
      .then(setBlockScreenshotsEnabled)
      .catch(() => {});
  }, []);

  if (Platform.OS === "web") {
    return (
      <>
        <Stack.Screen options={{ title: "Sécurité" }} />
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 18 }}>
            Le verrouillage n&apos;est pas disponible sur le web.
          </Text>
        </View>
      </>
    );
  }

  const onToggleLock = (enabled: boolean) => {
    setError(null);
    if (enabled) {
      router.push("/pin-setup?mode=create");
      return;
    }
    Alert.alert(
      "Désactiver le verrouillage",
      "Votre code sera supprimé et l'application ne sera plus protégée.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            setLockEnabled(false)
              .then(clearPinCredentials)
              .then(refreshLockConfig)
              .catch(() => setError("Le verrouillage n’a pas pu être modifié."))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  const onDelayChange = (seconds: number) => {
    setError(null);
    setBusy(true);
    setLockDelaySeconds(seconds)
      .then(refreshLockConfig)
      .catch(() => setError("Le délai de verrouillage n’a pas pu être enregistré."))
      .finally(() => setBusy(false));
  };

  const onToggleBlockScreenshots = (blocked: boolean) => {
    setError(null);
    setBusy(true);
    setBlockScreenshots(blocked)
      .then(() => setBlockScreenshotsEnabled(blocked))
      .catch(() => setError("La protection des captures n’a pas pu être modifiée."))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Stack.Screen options={{ title: "Sécurité" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.label }]}>Protégez Wallet</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Contrôlez l’accès à vos données financières avec un code ou la biométrie.</Text>
        </View>
        {error ? <InlineError message={error} /> : null}
        <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg }}>
          <View style={[styles.row, styles.switchRow]}>
            <View style={styles.switchText}>
              <Text style={{ color: theme.label, fontWeight: "600" }}>
                Verrouillage de l&apos;application
              </Text>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                Empreinte ou code à 6 chiffres à l&apos;ouverture et au retour dans l&apos;app.
              </Text>
            </View>
            <Switch
              value={lock.enabled}
              onValueChange={onToggleLock}
              disabled={busy}
              accessibilityLabel="Verrouillage de l'application"
            />
          </View>
          {lock.enabled ? (
            <View>
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.separator,
                  marginLeft: spacing.lg,
                }}
              />
              <Pressable
                onPress={() => router.push("/pin-setup?mode=change")}
                accessibilityRole="button"
                accessibilityLabel="Changer le code"
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              >
                <LockKeyhole size={20} strokeWidth={2} color={theme.accent} />
                <Text style={[styles.rowLabel, { color: theme.label }]}>
                  Changer le code
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {Platform.OS === "android" ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>
              CAPTURES D&apos;ÉCRAN
            </Text>
            <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg }}>
              <View style={[styles.row, styles.switchRow]}>
                <View style={styles.switchText}>
                  <Text style={{ color: theme.label, fontWeight: "600" }}>
                    Masquer l&apos;écran aux captures
                  </Text>
                  <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                    Empêche les captures, les enregistrements d&apos;écran et l&apos;aperçu
                    dans le multitâche.
                  </Text>
                </View>
                <Switch
                  value={blockScreenshotsEnabled}
                  onValueChange={onToggleBlockScreenshots}
                  disabled={busy}
                  accessibilityLabel="Masquer l'écran aux captures"
                />
              </View>
            </View>
          </View>
        ) : null}

        {lock.enabled ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>
              VERROUILLAGE AUTOMATIQUE
            </Text>
            <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg }}>
              {LOCK_DELAY_OPTIONS_SECONDS.map((seconds, index) => (
                <View key={seconds}>
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
                    onPress={() => onDelayChange(seconds)}
                    accessibilityRole="radio"
                    accessibilityLabel={formatDelay(seconds)}
                    accessibilityState={{ selected: lock.delaySeconds === seconds }}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={[styles.rowLabel, { color: theme.label }]}>
                      {formatDelay(seconds)}
                    </Text>
                    {lock.delaySeconds === seconds ? (
                      <Check size={18} strokeWidth={2.4} color={theme.accent} />
                    ) : null}
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {lock.enabled ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>
              PROTECTION
            </Text>
            <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                {biometricAvailable ? (
                  <ShieldCheck size={18} strokeWidth={2} color={theme.income} />
                ) : (
                  <Lock size={18} strokeWidth={2} color={theme.warning} />
                )}
                <Text style={{ color: theme.label, fontSize: 13, flex: 1 }}>
                  {biometricAvailable
                    ? "Empreinte disponible : vous pourrez déverrouiller sans saisir le code."
                    : "Aucune empreinte enregistrée sur l'appareil : le code seul protège l'app."}
                </Text>
              </View>
              <ActionButton
                label="Verrouiller maintenant"
                variant="secondary"
                onPress={lockNow}
              />
            </View>
          </View>
        ) : null}

        <Text style={{ color: theme.secondaryLabel, fontSize: 12, lineHeight: 17 }}>
          Le verrouillage empêche l&apos;accès à l&apos;application, mais les données restent
          stockées sur l&apos;appareil. Pour les protéger en dehors du téléphone, utilisez
          l&apos;export chiffré dans Paramètres → Données.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  intro: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.2 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  switchRow: {
    alignItems: "flex-start",
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    flex: 1,
    fontWeight: "600",
  },
});
