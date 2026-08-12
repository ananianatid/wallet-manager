import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MonthPicker } from "@/components/month-picker";
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import { formatMonthLabel } from "@/utils/format";

const HEADER_HEIGHT = 44;

interface Props {
  year: number;
  month: number;
  years: number[];
  onChange: (year: number, month: number) => void;
}

export function MonthHeader({ year, month, years, onChange }: Props) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onChange(d.getFullYear(), d.getMonth());
  };

  return (
    <>
      <View style={styles.row}>
        <Pressable
          onPress={() => shift(-1)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.arrow,
            pressed && { backgroundColor: withAlpha(theme.accent, "12") },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Mois précédent"
        >
          <ChevronLeft size={24} strokeWidth={2.4} color={theme.accent} />
        </Pressable>
        <Pressable
          onPress={() => setPickerOpen(true)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.monthButton,
            pressed && { backgroundColor: withAlpha(theme.accent, "12") },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Choisir un mois"
          accessibilityValue={{ text: formatMonthLabel(year, month) }}
        >
          <Text style={[styles.label, { color: theme.label }]}>
            {formatMonthLabel(year, month)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => shift(1)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.arrow,
            pressed && { backgroundColor: withAlpha(theme.accent, "12") },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
        >
          <ChevronRight size={24} strokeWidth={2.4} color={theme.accent} />
        </Pressable>
      </View>
      <MonthPicker
        visible={pickerOpen}
        year={year}
        month={month}
        years={years}
        onSelect={(y, m) => {
          onChange(y, m);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  arrow: {
    minWidth: 48,
    height: HEADER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  monthButton: {
    height: HEADER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  label: {
    fontSize: 17,
    fontWeight: "700",
    textTransform: "capitalize",
  },
});
