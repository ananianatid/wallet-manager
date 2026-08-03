import Constants from "expo-constants";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
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
          <Text style={styles.logoText}>W</Text>
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
    color: "#0A0A0B",
    fontSize: 36,
    fontWeight: "800",
  },
});
