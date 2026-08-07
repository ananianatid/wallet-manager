import { Fingerprint, Wallet } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { PinDots, PinKeypad } from "@/components/pin-keypad";
import { PIN_LENGTH } from "@/security/pin";
import {
  checkPinAttemptState,
  verifyPinGuarded,
} from "@/security/pin-attempts";
import { unlock } from "@/state/lock";
import { resetAppData } from "@/security/reset-app";
import { radius, spacing, useTheme } from "@/theme";

interface LockScreenProps {
  obscured: boolean;
}

export function LockScreen({ obscured }: LockScreenProps) {
  const theme = useTheme();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lockoutLeft, setLockoutLeft] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const isLockedOut = lockoutLeft > 0;

  useEffect(() => {
    if (obscured) {
      return;
    }
    let cancelled = false;
    void checkPinAttemptState().then((state) => {
      if (cancelled || !state.lockedOut) {
        return;
      }
      const seconds = Math.ceil(state.remainingMs / 1000);
      setLockoutLeft(seconds);
      setError(`Code erroné. Réessayez dans ${seconds} s.`);
    });
    return () => {
      cancelled = true;
    };
  }, [obscured]);

  useEffect(() => {
    if (obscured) {
      return;
    }
    LocalAuthentication.hasHardwareAsync()
      .then((hasHardware) =>
        hasHardware ? LocalAuthentication.isEnrolledAsync() : false,
      )
      .then(setBiometricAvailable)
      .catch(() => setBiometricAvailable(false));
  }, [obscured]);

  const authenticate = async () => {
    if (authenticating || isLockedOut) {
      return;
    }
    setAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Déverrouiller Wallet",
        disableDeviceFallback: true,
      });
      if (result.success) {
        unlock();
      }
    } catch {
      setError("Authentification impossible. Utilisez votre code.");
    } finally {
      setAuthenticating(false);
    }
  };

  const autoPrompted = useRef(false);

  useEffect(() => {
    if (obscured) {
      return;
    }
    if (!biometricAvailable || isLockedOut || autoPrompted.current) {
      return;
    }
    autoPrompted.current = true;
    const timer = setTimeout(() => {
      void authenticate();
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obscured, biometricAvailable, isLockedOut]);

  useEffect(() => {
    if (!isLockedOut) {
      return;
    }
    const timer = setInterval(() => {
      setLockoutLeft((left) => Math.max(0, left - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLockedOut]);

  const onKey = (digit: string) => {
    if (isLockedOut) {
      return;
    }
    setError(null);
    const next = pin.length < PIN_LENGTH ? pin + digit : pin;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      void verify(next);
    }
  };

  const verify = async (candidate: string) => {
    const { ok, state } = await verifyPinGuarded(candidate);
    if (ok) {
      setPin("");
      unlock();
      return;
    }
    setPin("");
    if (state.lockedOut) {
      const seconds = Math.ceil(state.remainingMs / 1000);
      setLockoutLeft(seconds);
      setError(`Code erroné. Réessayez dans ${seconds} s.`);
    } else {
      setError(
        `Code erroné. ${state.remainingAttempts} tentative${state.remainingAttempts > 1 ? "s" : ""} restante${state.remainingAttempts > 1 ? "s" : ""}.`,
      );
    }
  };

  const onForgotPin = () => {
    Alert.alert(
      "Code oublié",
      "Sans le code, la seule issue est de réinitialiser l'application : toutes les données locales seront supprimées. Une sauvegarde chiffrée reste nécessaire pour les retrouver.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser l'app",
          style: "destructive",
          onPress: () => {
            void resetAppData().then(() => unlock());
          },
        },
      ],
    );
  };

  if (obscured) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Wallet size={44} strokeWidth={1.8} color={theme.secondaryLabel} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Wallet size={44} strokeWidth={1.8} color={theme.accent} />
        <Text style={[styles.title, { color: theme.label }]}>Wallet verrouillé</Text>
        <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>
          {biometricAvailable
            ? "Déverrouillez avec votre empreinte ou votre code."
            : "Saisissez votre code pour déverrouiller."}
        </Text>
      </View>

      {error ? (
        <Text style={[styles.error, { color: theme.expense }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <PinDots length={pin.length} total={PIN_LENGTH} />

      <PinKeypad onKey={onKey} onDelete={() => setPin((p) => p.slice(0, -1))} deleteDisabled={pin.length === 0} />

      <View style={styles.footer}>
        {biometricAvailable ? (
          <Pressable
            onPress={() => void authenticate()}
            accessibilityRole="button"
            accessibilityLabel="Utiliser l'empreinte"
            style={({ pressed }) => [styles.biometricButton, pressed && { opacity: 0.6 }]}
          >
            <Fingerprint size={24} strokeWidth={2} color={theme.accent} />
            <Text style={[styles.biometricLabel, { color: theme.accent }]}>
              Utiliser l&apos;empreinte
            </Text>
          </Pressable>
        ) : (
          <View style={styles.biometricButton} />
        )}
        <Pressable
          onPress={onForgotPin}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.forgot, { color: theme.secondaryLabel }]}>Code oublié ?</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
  },
  header: {
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    minHeight: 18,
  },
  footer: {
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    minHeight: 48,
    justifyContent: "center",
  },
  biometricLabel: {
    fontWeight: "700",
    fontSize: 15,
  },
  forgot: {
    fontSize: 13,
    padding: spacing.sm,
  },
});
