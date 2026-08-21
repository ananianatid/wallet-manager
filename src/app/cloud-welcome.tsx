import { Stack, router } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import { ActionButton, KeyboardAwareScreen } from "@/components/ui";
import { getDatabase } from "@/db/database";
import { getSetting, setSetting } from "@/db/settings";
import { spacing, typography, useTheme } from "@/theme";

export default function CloudWelcomeScreen() {
  const theme = useTheme();

  const continueWithoutAccount = async () => {
    const db = await getDatabase();
    await setSetting(db, "cloud_welcome_seen", "1");
    const completed = await getSetting(db, "onboarding_completed");
    router.replace(completed === "1" ? "/(tabs)/(dashboard)" : "/onboarding");
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAwareScreen contentContainerStyle={styles.content}>
        <Image
          source={require("../../assets/images/wallet-logo-green-v4.png")}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Logo Wallet"
          style={styles.logo}
        />
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>BIENVENUE DANS WALLET</Text>
          <Text style={[styles.title, { color: theme.label }]}>Vos données, où que vous soyez.</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Utilisez Wallet entièrement sans compte, ou créez un compte pour retrouver vos données sur votre téléphone et votre PC.</Text>
        </View>
        <View style={styles.actions}>
          <ActionButton label="Créer un compte" onPress={() => router.push("/cloud-account")} />
          <ActionButton label="Continuer sans compte" variant="secondary" onPress={() => void continueWithoutAccount()} />
        </View>
      </KeyboardAwareScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.xxl },
  logo: { width: 132, height: 132, alignSelf: "center" },
  copy: { gap: spacing.sm },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  title: { ...typography.display },
  subtitle: { ...typography.body, lineHeight: 23 },
  actions: { gap: spacing.md },
});
