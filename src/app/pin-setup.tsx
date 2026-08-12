import { Stack, useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { PinDots, PinKeypad } from "@/components/pin-keypad";
import { PIN_LENGTH, hashPin } from "@/security/pin";
import { verifyPinGuarded } from "@/security/pin-attempts";
import {
  setLockEnabled,
  setPinCredentials,
} from "@/security/store";
import { refreshLockConfig } from "@/state/lock";
import { spacing, useTheme } from "@/theme";

type PinSetupMode = "create" | "change";

const TITLES: Record<PinSetupMode, string> = {
  create: "Créer un code",
  change: "Changer le code",
};

function StepMessage({
  step,
  mode,
  error,
}: {
  step: "verify" | "enter" | "confirm";
  mode: PinSetupMode;
  error: string | null;
}) {
  const theme = useTheme();
  if (error) {
    return (
      <Text style={[styles.message, { color: theme.expense }]} accessibilityRole="alert">
        {error}
      </Text>
    );
  }
  const text =
    step === "verify"
      ? "Entrez votre code actuel pour confirmer."
      : step === "enter"
        ? mode === "create"
          ? "Choisissez un code à 6 chiffres."
          : "Choisissez votre nouveau code."
        : "Confirmez votre code.";
  return (
    <Text style={[styles.message, { color: theme.secondaryLabel }]}>{text}</Text>
  );
}

export default function PinSetupScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: PinSetupMode = params.mode === "change" ? "change" : "create";

  const [step, setStep] = useState<"verify" | "enter" | "confirm">(
    mode === "change" ? "verify" : "enter",
  );
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onKey = (digit: string) => {
    if (busy) {
      return;
    }
    setError(null);
    const next = pin.length < PIN_LENGTH ? pin + digit : pin;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      void advance(next);
    }
  };

  const advance = async (candidate: string) => {
    setBusy(true);
    try {
      if (step === "verify") {
        const { ok, state } = await verifyPinGuarded(candidate);
        if (!ok) {
          setPin("");
          setError(
            state.lockedOut
              ? `Code erroné. Réessayez dans ${Math.ceil(state.remainingMs / 1000)} s.`
              : "Code actuel incorrect.",
          );
          return;
        }
        setPin("");
        setStep("enter");
        return;
      }
      if (step === "enter") {
        setFirstPin(candidate);
        setPin("");
        setStep("confirm");
        return;
      }
      if (candidate !== firstPin) {
        setPin("");
        setFirstPin("");
        setStep("enter");
        setError("Les deux codes ne correspondent pas.");
        return;
      }
      const salt = Crypto.getRandomBytes(16);
      await setPinCredentials(salt, await hashPin(candidate, salt));
      if (mode === "create") {
        await setLockEnabled(true);
        await refreshLockConfig();
      }
      router.back();
    } catch {
      setError("Enregistrement impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: TITLES[mode] }} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StepMessage step={step} mode={mode} error={error} />
        <View
          style={styles.progress}
          accessible
          accessibilityLabel={`Étape ${step === "verify" ? 1 : step === "enter" ? 1 : 2} sur ${mode === "change" ? 3 : 2}`}
        >
          <View style={[styles.progressSegment, { backgroundColor: theme.accent }]} />
          <View style={[styles.progressSegment, { backgroundColor: step === "confirm" ? theme.accent : theme.separator }]} />
        </View>
        <PinDots length={pin.length} total={PIN_LENGTH} />
        {busy ? (
          <View style={styles.busy} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={theme.accent} />
            <Text style={{ color: theme.secondaryLabel }}>Vérification…</Text>
          </View>
        ) : null}
        <PinKeypad
          onKey={onKey}
          onDelete={() => setPin((p) => p.slice(0, -1))}
          deleteDisabled={pin.length === 0}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    padding: spacing.xl,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    minHeight: 20,
  },
  progress: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 240,
    gap: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  busy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 20,
  },
});
