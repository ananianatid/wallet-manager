import { Check } from "lucide-react-native";
import { Stack } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getThemePalette,
  radius,
  spacing,
  useTheme,
  useThemeControl,
  withAlpha,
  type AccentTheme,
  type ThemeMode,
} from "@/theme";

const OPTIONS: { value: ThemeMode; label: string; hint: string }[] = [
  { value: "system", label: "Système", hint: "Suivre l'apparence du téléphone" },
  { value: "light", label: "Clair", hint: "Fond clair en permanence" },
  { value: "dark", label: "Sombre", hint: "Fond sombre en permanence" },
];

const ACCENT_OPTIONS: { value: AccentTheme; label: string; hint: string }[] = [
  { value: "blue", label: "Bleu", hint: "Accent #339CFF" },
  { value: "midnight", label: "Bleu nuit", hint: "Thème général #123A60" },
  { value: "green", label: "Vert", hint: "Accent vert d’origine" },
];

const SWATCH_COLORS = [
  "background",
  "surface",
  "accentSurface",
  "accent",
  "income",
  "expense",
] as const;

function PalettePreview({
  modes,
  accentTheme,
}: {
  modes: ("light" | "dark")[];
  accentTheme: AccentTheme;
}) {
  return (
    <View style={styles.preview}>
      {modes.map((mode) => {
        const palette = getThemePalette(mode, accentTheme);
        return (
          <View key={mode} style={styles.previewRow}>
            {SWATCH_COLORS.map((key) => (
              <View
                key={key}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: palette[key],
                    borderColor: withAlpha(palette.outline, "66"),
                  },
                ]}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function AccentPreview({ accentTheme }: { accentTheme: AccentTheme }) {
  const accent = getThemePalette("light", accentTheme);
  return (
    <View style={styles.accentPreview}>
      <View style={[styles.accentDot, { backgroundColor: accent.accent }]} />
      <View style={[styles.accentAction, { backgroundColor: accent.accentSurface }]}>
        <Text style={{ color: accent.accentSurfaceText, fontSize: 11, fontWeight: "700" }}>
          Action
        </Text>
      </View>
    </View>
  );
}

export default function AppearanceScreen() {
  const theme = useTheme();
  const { mode, setMode, accentTheme, setAccentTheme } = useThemeControl();

  return (
    <>
      <Stack.Screen options={{ title: "Apparence" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.label }]}>Personnalisez l’apparence</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Choisissez le mode d’affichage et la couleur utilisée pour les actions principales.</Text>
        </View>
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>MODE D’AFFICHAGE</Text>
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
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityHint={option.hint}
                accessibilityState={{ selected: mode === option.value }}
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
                  <PalettePreview
                    modes={
                      option.value === "system"
                        ? ["light", "dark"]
                        : option.value === "light"
                          ? ["light"]
                          : ["dark"]
                    }
                    accentTheme={accentTheme}
                  />
                </View>
                {mode === option.value ? (
                  <Check size={18} strokeWidth={2.4} color={theme.accent} />
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>
            Couleur d’accent
          </Text>
          {ACCENT_OPTIONS.map((option, index) => (
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
                onPress={() => setAccentTheme(option.value)}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityHint={option.hint}
                accessibilityState={{ selected: accentTheme === option.value }}
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
                  <AccentPreview accentTheme={option.value} />
                </View>
                {accentTheme === option.value ? (
                  <Check size={18} strokeWidth={2.4} color={theme.accent} />
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  intro: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  preview: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  previewRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  accentPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  accentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  accentAction: {
    minWidth: 66,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
});
