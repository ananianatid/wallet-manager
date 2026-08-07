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
        accessibilityLabel="Choisir l'année"
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
            >
              <Text
                style={{
                  color: selected ? theme.onAccent : theme.label,
                  fontWeight: selected ? "700" : "500",
                  fontSize: 14,
                }}
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
        initialScrollIndex={Math.max(years.indexOf(browsedYear), 0)}
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
            >
              <Text style={{ color: theme.label, flex: 1, fontSize: 15 }}>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  backBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
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
  },
});
