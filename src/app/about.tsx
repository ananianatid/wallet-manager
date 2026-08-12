import Constants from "expo-constants";
import { router, Stack } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";

export default function AboutScreen() {
  const theme = useTheme();
  const name = Constants.expoConfig?.name ?? "Wallet";
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <>
      <Stack.Screen options={{ title: "À propos" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Image
          source={require("../../assets/images/wallet-logo-square.png")}
          accessibilityLabel="Logo Wallet"
          resizeMode="contain"
          style={styles.logo}
        />
        <Text accessibilityRole="header" style={{ color: theme.label, fontSize: 26, fontWeight: "800" }}>
          {name}
        </Text>
        <Text style={{ color: theme.secondaryLabel }}>Version {version}</Text>
        <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
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
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    marginBottom: spacing.sm,
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
  infoCard: {
    width: "100%",
    marginTop: spacing.lg,
    alignItems: "center",
    gap: 2,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
});
