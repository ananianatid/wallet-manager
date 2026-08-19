import { Check } from "lucide-react-native";
import { Stack } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme, useThemeControl, type ThemeMode } from "@/theme";

const OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: "system", label: "Système", hint: "Suivre l'apparence du téléphone" },
  { value: "light", label: "Clair", hint: "Fond clair en permanence" },
  { value: "dark", label: "Sombre", hint: "Fond sombre en permanence" },
];

function PalettePreview({ mode }: { mode: ThemeMode }) {
  const theme = useTheme();
  const colors = mode === "dark"
    ? ["#101713", "#17201A", "#26352D", "#B0D2B8", "#8DBA96", "#E28A80"]
    : ["#F5F5F2", "#FFFFFF", "#26352D", "#26352D", "#4C6656", "#B75C52"];
  return (
    <View style={styles.preview}>
      <View style={styles.previewRow}>
        {colors.map((color) => (
          <View key={color} style={[styles.swatch, { backgroundColor: color, borderColor: theme.outline }]} />
        ))}
      </View>
    </View>
  );
}

export default function AppearanceScreen() {
  const theme = useTheme();
  const { mode, setMode } = useThemeControl();

  return (
    <>
      <Stack.Screen options={{ title: "Apparence" }} />
      <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.label }]}>Une apparence calme</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Le vert profond reste la signature de Wallet. Choisissez seulement la luminosité adaptée à votre environnement.</Text>
        </View>
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>MODE D’AFFICHAGE</Text>
          {OPTIONS.map((option, index) => (
            <View key={option.value}>
              {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.separator }]} /> : null}
              <Pressable
                onPress={() => setMode(option.value)}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityHint={option.hint}
                accessibilityState={{ selected: mode === option.value }}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.copy}>
                  <Text style={{ color: theme.label, fontWeight: "600" }}>{option.label}</Text>
                  <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>{option.hint}</Text>
                  <PalettePreview mode={option.value} />
                </View>
                {mode === option.value ? <Check size={20} strokeWidth={2.4} color={theme.accent} /> : null}
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  intro: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.8 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  section: { borderRadius: radius.lg, overflow: "hidden" },
  sectionTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg, gap: spacing.md, minHeight: 48 },
  copy: { flex: 1, gap: 2 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
  preview: { marginTop: spacing.sm },
  previewRow: { flexDirection: "row", gap: spacing.xs },
  swatch: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.66 },
});
