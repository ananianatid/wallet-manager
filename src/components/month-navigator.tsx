import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "@/theme";
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
      <Pressable onPress={() => shift(-1)} hitSlop={12} style={styles.arrow}>
        <Text style={[styles.arrowText, { color: theme.accent }]}>‹</Text>
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
      <Pressable onPress={() => shift(1)} hitSlop={12} style={styles.arrow}>
        <Text style={[styles.arrowText, { color: theme.accent }]}>›</Text>
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
    paddingHorizontal: spacing.md,
  },
  arrowText: {
    fontSize: 24,
    fontWeight: "600",
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
});
