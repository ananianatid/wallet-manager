import { Check } from "lucide-react-native";
import { Stack } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme, useThemeControl, type ThemeMode } from "@/theme";

const OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: "system", label: "Système", hint: "Suivre l'apparence du téléphone" },
  { value: "light", label: "Clair", hint: "Fond clair en permanence" },
  { value: "dark", label: "Sombre", hint: "Fond sombre en permanence" },
];

export default function AppearanceScreen() {
  const theme = useTheme();
  const { mode, setMode } = useThemeControl();

  return (
    <>
      <Stack.Screen options={{ title: "Apparence" }} />
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: radius.lg }}>
          {OPTIONS.map((option, index) => (
            <View key={option.value}>
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
                onPress={() => setMode(option.value)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.label, fontWeight: "600" }}>
                    {option.label}
                  </Text>
                  <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                    {option.hint}
                  </Text>
                </View>
                {mode === option.value ? (
                  <Check size={18} strokeWidth={2.4} color={theme.accent} />
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
});
