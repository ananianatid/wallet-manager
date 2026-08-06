import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import type { SafeToSpend } from "@/types";
import { formatAmount } from "@/utils/format";
import type { Totals } from "@/utils/statistics";

export function MonthlySummaryCard({ totals }: { totals: Totals }) {
  const theme = useTheme();

  return (
    <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
      <View style={styles.summaryFooter}>
        <View style={styles.footerItem}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 11 }}>Revenus</Text>
          <Text selectable style={[styles.footerValue, { color: theme.income }]}>
            + {formatAmount(totals.income)}
          </Text>
        </View>
        <View style={[styles.footerItem, styles.footerItemCenter]}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 11 }}>Dépenses</Text>
          <Text selectable style={[styles.footerValue, { color: theme.expense }]}>
            −{formatAmount(totals.expense + totals.fees)}
          </Text>
        </View>
        <View style={[styles.footerItem, styles.footerItemRight]}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 11 }}>
            Total du mois
          </Text>
          <Text
            selectable
            style={[
              styles.footerValue,
              { color: totals.net >= 0 ? theme.label : theme.expense },
            ]}
          >
            {formatAmount(totals.net)}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface Props {
  data: SafeToSpend;
  monthTotals?: Totals;
  onPress?: () => void;
  interactive?: boolean;
  compact?: boolean;
}

export function SafeToSpendCard({
  data,
  monthTotals,
  onPress,
  interactive = true,
  compact = false,
}: Props) {
  const theme = useTheme();
  const isNegative = data.amount < 0;
  const cardSurface = isNegative ? theme.dangerSurface : theme.accentSurface;
  const cardLabel = isNegative ? theme.dangerSurfaceLabel : theme.accentSurfaceLabel;
  const cardText = isNegative ? theme.dangerSurfaceText : theme.accentSurfaceText;
  const incomeColor = isNegative
    ? theme.dangerSurfaceIncome
    : theme.accentSurfaceIncome;
  const expenseColor = isNegative
    ? theme.dangerSurfaceExpense
    : theme.accentSurfaceExpense;

  const content = (
    <>
      <View style={styles.heading}>
        <View style={styles.titleBlock}>
          <Text style={{ color: cardLabel, fontSize: 13, fontWeight: "700" }}>
            DISPONIBLE ESTIMÉ
          </Text>
        </View>
        {interactive && onPress ? (
          <ChevronRight size={18} strokeWidth={2.2} color={cardLabel} />
        ) : null}
      </View>

      <Text
        style={[styles.amount, compact && styles.compactAmount, { color: cardText }]}
        selectable
      >
        {formatAmount(data.amount)}
      </Text>

      {isNegative && !compact ? (
        <Text style={{ color: cardLabel, lineHeight: 18 }}>
          Il manque {formatAmount(Math.abs(data.amount))} pour couvrir les échéances prévues.
        </Text>
      ) : null}

      {compact ? (
        <Text style={{ color: cardLabel, fontSize: 12 }}>
          Appuyez pour voir le calcul détaillé.
        </Text>
      ) : null}

      {interactive && !compact ? (
        <View style={[styles.footer, { borderTopColor: withAlpha(cardLabel, "66") }]}>
          <View style={styles.footerItem}>
            <Text style={{ color: cardLabel, fontSize: 11 }}>Revenus</Text>
            <Text style={[styles.footerValue, { color: incomeColor }]}>
              + {formatAmount(monthTotals?.income ?? data.plannedIncome)}
            </Text>
          </View>
          <View style={[styles.footerItem, styles.footerItemCenter]}>
            <Text style={{ color: cardLabel, fontSize: 11 }}>Dépenses</Text>
            <Text style={[styles.footerValue, { color: expenseColor }]}>
              −{formatAmount(monthTotals?.expense ?? data.plannedOutflows)}
            </Text>
          </View>
          <View style={[styles.footerItem, styles.footerItemRight]}>
            <Text style={{ color: cardLabel, fontSize: 11 }}>
              {monthTotals ? "Total du mois" : "Solde"}
            </Text>
            <Text
              style={[
                styles.footerValue,
                {
                  color:
                    (monthTotals ? monthTotals.net : data.amount) >= 0
                      ? cardText
                      : theme.dangerSurfaceLabel,
                },
              ]}
            >
              {formatAmount(monthTotals ? monthTotals.net : data.amount)}
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );

  if (interactive && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Voir le calcul détaillé du disponible estimé"
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: cardSurface },
          pressed && { opacity: 0.7 },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, { backgroundColor: cardSurface }]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
  },
  amount: {
    fontSize: 28,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  compactAmount: {
    fontSize: 22,
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  footerItem: {
    flex: 1,
    gap: spacing.xs,
    alignItems: "flex-start",
  },
  footerItemCenter: {
    alignItems: "center",
  },
  footerItemRight: {
    alignItems: "flex-end",
  },
  footerValue: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
