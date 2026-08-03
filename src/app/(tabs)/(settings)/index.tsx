import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";

const ENTRIES: {
  label: string;
  icon: string;
  href:
    | "/categories/income"
    | "/categories/expense"
    | "/categories/account"
    | "/appearance"
    | "/about";
}[] = [
  { label: "Catégories de revenus", icon: "↑", href: "/categories/income" },
  { label: "Catégories de dépenses", icon: "↓", href: "/categories/expense" },
  { label: "Catégories de comptes", icon: "▤", href: "/categories/account" },
  { label: "Apparence", icon: "◐", href: "/appearance" },
  { label: "À propos", icon: "ℹ", href: "/about" },
];

export default function SettingsScreen() {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
    >
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: radius.lg,
        }}
      >
        {ENTRIES.map((entry, index) => (
          <View key={entry.href}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.separator,
                  marginLeft: spacing.lg,
                }}
              />
            ) : null}
            <Pressable
              onPress={() => router.push(entry.href)}
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={{ color: theme.accent, fontWeight: "600", width: 24 }}>
                {entry.icon}
              </Text>
              <Text style={[styles.label, { color: theme.label }]}>
                {entry.label}
              </Text>
              <Text style={{ color: theme.secondaryLabel }}>›</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  label: {
    flex: 1,
    fontWeight: "600",
  },
});
