import { Stack, router } from "expo-router";
import { Check } from "lucide-react-native";
import { Image, StyleSheet, Text, View } from "react-native";
import { ActionButton, KeyboardAwareScreen } from "@/components/ui";
import { readAppSetting, writeAppSetting } from "@/data/app-settings";
import { radius, spacing, typography, useTheme, withAlpha } from "@/theme";

export default function CloudWelcomeScreen() {
  const theme = useTheme();

  const continueWithoutAccount = async () => {
    await writeAppSetting("cloud_welcome_seen", "1");
    const completed = await readAppSetting("onboarding_completed");
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
        <View style={[styles.benefits, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          {[
            "Retrouvez vos comptes sur Android et sur PC",
            "Synchronisation chiffrée, conservation locale",
            "Vous pouvez rester en mode local à tout moment",
          ].map((item) => (
            <View key={item} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: withAlpha(theme.accent, "16") }]}>
                <Check size={14} color={theme.accent} strokeWidth={2.5} />
              </View>
              <Text style={[styles.benefitText, { color: theme.label }]}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <ActionButton label="Créer un compte" onPress={() => router.push("/cloud-account")} />
          <ActionButton label="Continuer sans compte" variant="secondary" onPress={() => void continueWithoutAccount()} />
          <Text style={[styles.hint, { color: theme.secondaryLabel }]}>Vous pourrez activer la synchronisation à tout moment depuis Réglages → Compte et synchronisation.</Text>
        </View>
      </KeyboardAwareScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.xl },
  logo: { width: 132, height: 132, alignSelf: "center" },
  copy: { gap: spacing.sm },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  title: { ...typography.display },
  subtitle: { ...typography.body, lineHeight: 23 },
  benefits: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  benefitIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  benefitText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  actions: { gap: spacing.md },
  hint: { fontSize: 12, lineHeight: 17, textAlign: "center" },
});
