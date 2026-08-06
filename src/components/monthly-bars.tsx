import { ScrollView, StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "@/theme";
import type { MonthPoint } from "@/utils/statistics";

const BAR_HEIGHT = 130;
const BAR_WIDTH = 9;
const BAR_GAP = 3;

interface Props {
  series: MonthPoint[];
}

export function MonthlyBars({ series }: Props) {
  const theme = useTheme();
  const maxBar = Math.max(
    ...series.map((m) => Math.max(m.income, m.expense + m.fees)),
    1,
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.barsRow}>
        {series.map((m) => (
          <View key={`${m.year}-${m.month}`} style={styles.barGroup}>
            <View style={styles.barPair}>
              <View
                style={{
                  width: BAR_WIDTH,
                  height: Math.max(
                    (m.income / maxBar) * BAR_HEIGHT,
                    m.income > 0 ? 2 : 0,
                  ),
                  backgroundColor: theme.income,
                  borderRadius: 3,
                }}
              />
              <View
                style={{
                  width: BAR_WIDTH,
                  height: Math.max(
                    ((m.expense + m.fees) / maxBar) * BAR_HEIGHT,
                    m.expense + m.fees > 0 ? 2 : 0,
                  ),
                  backgroundColor: theme.expense,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={[styles.monthLabel, { color: theme.secondaryLabel }]}>
              {new Date(m.year, m.month, 1)
                .toLocaleDateString("fr-FR", { month: "short" })
                .replace(".", "")}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    height: BAR_HEIGHT + 22,
  },
  barGroup: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  barPair: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: BAR_GAP,
    height: BAR_HEIGHT,
  },
  monthLabel: {
    fontSize: 11,
  },
});
