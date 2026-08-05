import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
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
        <Pressable
          accessibilityRole="button"
          onPress={() => undefined}
          style={({ pressed }) => [
            styles.paymentRow,
            { backgroundColor: theme.surface, borderBottomColor: theme.separator },
            pressed && { opacity: 0.55 },
          ]}
        >
          <Text style={[styles.paymentLabel, { color: theme.label }]}>Mode de paiement par carte</Text>
          <Text style={[styles.paymentValue, { color: theme.accent }]}>A. Montants individuels</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1 },
  paymentRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  paymentLabel: { fontSize: 16, fontWeight: "600", flexShrink: 1 },
  paymentValue: { fontSize: 14, fontWeight: "600", flexShrink: 0 },
});
