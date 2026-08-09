import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

export default function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    log.error("app", "Erreur d'affichage non gérée", error);
  }, [error]);

  return (
    <View style={styles.crashScreen}>
      <Text style={styles.crashTitle}>Une erreur inattendue est survenue</Text>
      <Text style={styles.crashMessage}>
        {userMessage(error, "Vos données sont intactes. Réessayez.")}
      </Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Réessayer"
        style={({ pressed }) => [styles.crashButton, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.crashButtonText}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  crashScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 32,
    backgroundColor: "#FFFFFF",
  },
  crashTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0A0A0B",
    textAlign: "center",
  },
  crashMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: "#52525B",
    textAlign: "center",
  },
  crashButton: {
    marginTop: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: "#339CFF",
  },
  crashButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
