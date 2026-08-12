import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LegacyTextRow } from "@/components/legacy-money-manager";
import { radius, spacing, useTheme } from "@/theme";

const entries = [
  { label: "Groupes de comptes", pathname: "/(tabs)/(settings)/account-groups" },
  { label: "Gestion des comptes", pathname: "/(tabs)/(settings)/accounts-management" },
] as const;

export default function AccountsSettingsScreen() {
  const theme = useTheme();
  return (
    <>
      <Stack.Screen
        options={{
          title: "Comptes",
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Retour"
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                if (router.canGoBack()) router.back();
              }}
            >
              <ArrowLeft size={24} color={theme.accent} strokeWidth={2.2} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={[styles.screen, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.label }]}>Organiser vos comptes</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Gérez les groupes et les comptes utilisés par vos transactions.</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {entries.map((entry) => (
            <LegacyTextRow key={entry.label} label={entry.label} onPress={() => router.push(entry.pathname)} />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.lg },
  intro: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.2 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: { borderRadius: radius.lg, overflow: "hidden" },
});
