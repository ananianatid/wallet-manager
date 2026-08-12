import { Check, ChevronDown, ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";

const MONTHS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

interface Props {
  years: number[];
  selectedYear: number;
  selectedMonth: number;
  onSelect: (year: number, month: number) => void;
  yearsMaxHeight?: number;
}

const YEAR_ROW_HEIGHT = 48;

export function MonthGridPicker({
  years,
  selectedYear,
  selectedMonth,
  onSelect,
  yearsMaxHeight = 320,
}: Props) {
  const theme = useTheme();
  const [mode, setMode] = useState<"months" | "years">("months");
  const [browsedYear, setBrowsedYear] = useState(selectedYear);

  return mode === "months" ? (
    <>
      <Pressable
        onPress={() => setMode("years")}
        style={({ pressed }) => [
          styles.yearBar,
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Choisir l'année"
        accessibilityHint="Affiche la liste des années."
      >
        <Text style={[styles.yearBarLabel, { color: theme.label }]}>
          {browsedYear}
        </Text>
        <ChevronDown size={20} strokeWidth={2.2} color={theme.accent} />
      </Pressable>
      <View style={styles.grid}>
        {MONTHS.map((label, index) => {
          const selected = browsedYear === selectedYear && index === selectedMonth;
          return (
            <Pressable
              key={label}
              onPress={() => onSelect(browsedYear, index)}
              style={({ pressed }) => [
                styles.monthCell,
                {
                  backgroundColor: selected ? theme.accent : theme.surface,
                  borderColor: selected ? theme.accent : theme.separator,
                },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${browsedYear}`}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.monthLabel,
                  { color: selected ? theme.onAccent : theme.label },
                  selected && styles.selectedMonthLabel,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  ) : (
    <>
      <Pressable
        onPress={() => setMode("months")}
        style={({ pressed }) => [
          styles.backBar,
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="button"
        accessibilityHint="Revient au choix des mois."
        accessibilityLabel="Revenir au choix du mois"
      >
        <ChevronLeft size={20} strokeWidth={2.2} color={theme.accent} />
        <Text style={[styles.backLabel, { color: theme.label }]}>
          {browsedYear}
        </Text>
      </Pressable>
      <FlatList
        data={years}
        keyExtractor={(y) => String(y)}
        style={{ maxHeight: yearsMaxHeight }}
        initialScrollIndex={years.length ? Math.max(years.indexOf(browsedYear), 0) : undefined}
        getItemLayout={(_, index) => ({
          length: YEAR_ROW_HEIGHT,
          offset: YEAR_ROW_HEIGHT * index,
          index,
        })}
        renderItem={({ item: sectionYear }) => {
          const selected = sectionYear === browsedYear;
          return (
            <Pressable
              onPress={() => {
                setBrowsedYear(sectionYear);
                setMode("months");
              }}
              style={({ pressed }) => [
                styles.yearRow,
                { backgroundColor: pressed ? theme.surface : "transparent" },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={String(sectionYear)}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.yearLabel, { color: theme.label }]}>
                {sectionYear}
              </Text>
              {selected ? (
                <Check size={18} strokeWidth={2.4} color={theme.accent} />
              ) : null}
            </Pressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  yearBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  yearBarLabel: {
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.sm,
  },
  monthCell: {
    flexBasis: "30%",
    alignItems: "center",
    paddingVertical: spacing.md,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  selectedMonthLabel: {
    fontWeight: "700",
  },
  backBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    minHeight: 44,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  backLabel: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: YEAR_ROW_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  yearLabel: {
    flex: 1,
    fontSize: 15,
  },
});
