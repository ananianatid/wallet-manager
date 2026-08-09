import Constants from "expo-constants";
import { router, Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "@/theme";

export default function AboutScreen() {
  const theme = useTheme();
  const name = Constants.expoConfig?.name ?? "Wallet";
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <>
      <Stack.Screen options={{ title: "À propos" }} />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          padding: spacing.xl,
        }}
      >
        <View
          style={[
            styles.logo,
            { backgroundColor: theme.accent },
          ]}
        >
        <Text style={[styles.logoText, { color: theme.onAccent }]}>W</Text>
        </View>
        <Text style={{ color: theme.label, fontSize: 22, fontWeight: "800" }}>
          {name}
        </Text>
        <Text style={{ color: theme.secondaryLabel }}>Version {version}</Text>
        <View
          style={{
            marginTop: spacing.lg,
            alignItems: "center",
            gap: 2,
          }}
        >
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Suivez vos dépenses simplement, en FCFA.
          </Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Créé avec Expo · SDK 57
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/diagnostics")}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir les diagnostics"
          style={({ pressed }) => [
            styles.diagnosticsLink,
            { borderColor: theme.outline },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={{ color: theme.accent, fontWeight: "700" }}>Diagnostics</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "800",
  },
  diagnosticsLink: {
    marginTop: spacing.xl,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
