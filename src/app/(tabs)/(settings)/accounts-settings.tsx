import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { LegacyTextRow } from "@/components/legacy-money-manager";
import { useTheme } from "@/theme";

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
        {entries.map((entry) => (
          <LegacyTextRow key={entry.label} label={entry.label} onPress={() => router.push(entry.pathname)} />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
});
