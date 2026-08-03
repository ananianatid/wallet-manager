import { ChevronLeft, ChevronRight } from "lucide-react-native";
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
      <Pressable onPress={() => shift(1)} hitSlop={12} style={styles.arrow}>
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
    paddingHorizontal: spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
});
