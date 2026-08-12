import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import { formatMonthLabel } from "@/utils/format";

interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function MonthNavigator({ year, month, onChange }: Props) {
  const theme = useTheme();
  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onChange(d.getFullYear(), d.getMonth());
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => shift(-1)}
        accessibilityRole="button"
        accessibilityLabel="Mois précédent"
        style={({ pressed }) => [styles.arrow, pressed && { backgroundColor: withAlpha(theme.accent, "12") }]}
      >
        <ChevronLeft size={26} strokeWidth={2.4} color={theme.accent} />
      </Pressable>
      <Text
        style={[
          styles.label,
          { color: theme.label },
          { textTransform: "capitalize" },
        ]}
      >
        {formatMonthLabel(year, month)}
      </Text>
      <Pressable
        onPress={() => shift(1)}
        accessibilityRole="button"
        accessibilityLabel="Mois suivant"
        style={({ pressed }) => [styles.arrow, pressed && { backgroundColor: withAlpha(theme.accent, "12") }]}
      >
        <ChevronRight size={26} strokeWidth={2.4} color={theme.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  arrow: {
    width: 48,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
});
