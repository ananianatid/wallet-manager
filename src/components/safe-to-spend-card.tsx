import { ChevronRight } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import { useCurrency } from "@/currency/context";
import type { SafeToSpend } from "@/types";
import { formatAmount } from "@/utils/format";
import type { Totals } from "@/utils/statistics";

export function MonthlySummaryCard({
  totals,
  totalLabel = "Total du mois",
  fullWidth = false,
  loading = false,
}: {
  totals: Totals;
  totalLabel?: string;
  fullWidth?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const { baseCurrency } = useCurrency();
  const cardLabel = theme.accentSurfaceLabel;

  return (
    <View
      style={[
        styles.summaryCard,
        fullWidth && styles.fullWidthSummaryCard,
        { backgroundColor: theme.accentSurface },
      ]}
    >
      {loading ? (
        <View
          style={styles.summaryLoading}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Calcul de la période"
        >
          <ActivityIndicator color={cardLabel} />
          <Text style={{ color: cardLabel, fontWeight: "600" }}>
            Calcul de la période…
          </Text>
        </View>
      ) : (
        <View style={styles.summaryFooter}>
          <View style={styles.footerItem}>
            <Text style={{ color: cardLabel, fontSize: 11 }}>Revenus</Text>
            <Text selectable style={[styles.footerValue, { color: theme.accentSurfaceIncome }]}>
              + {formatAmount(totals.income, baseCurrency)}
            </Text>
          </View>
          <View style={[styles.footerItem, styles.footerItemCenter]}>
            <Text style={{ color: cardLabel, fontSize: 11 }}>Dépenses</Text>
            <Text selectable style={[styles.footerValue, { color: theme.accentSurfaceExpense }]}>
              −{formatAmount(totals.expense + totals.fees, baseCurrency)}
            </Text>
          </View>
          <View style={[styles.footerItem, styles.footerItemRight]}>
            <Text style={{ color: cardLabel, fontSize: 11 }}>{totalLabel}</Text>
            <Text
              selectable
              style={[
                styles.footerValue,
                {
                  color:
                    totals.net >= 0
                      ? theme.accentSurfaceText
                      : theme.accentSurfaceExpense,
                },
              ]}
            >
              {formatAmount(totals.net, baseCurrency)}
            </Text>
          </View>
        </View>
      )}
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
  const { baseCurrency } = useCurrency();
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
        {formatAmount(data.amount, baseCurrency)}
      </Text>

      {data.balanceBeforeCalculation != null ? (
        <Text style={{ color: cardLabel, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          Solde avant calcul : {formatAmount(data.balanceBeforeCalculation, baseCurrency)}
        </Text>
      ) : null}

      {isNegative && !compact ? (
        <Text style={{ color: cardLabel, lineHeight: 18 }}>
          Il manque {formatAmount(Math.abs(data.amount), baseCurrency)} pour couvrir les échéances prévues.
        </Text>
      ) : null}

      {interactive && !compact ? (
        <View style={[styles.footer, { borderTopColor: withAlpha(cardLabel, "66") }]}>
          <View style={styles.footerItem}>
            <Text style={{ color: cardLabel, fontSize: 11 }}>Revenus</Text>
            <Text style={[styles.footerValue, { color: incomeColor }]}>
              + {formatAmount(monthTotals?.income ?? data.plannedIncome, baseCurrency)}
            </Text>
          </View>
          <View style={[styles.footerItem, styles.footerItemCenter]}>
            <Text style={{ color: cardLabel, fontSize: 11 }}>Dépenses</Text>
            <Text style={[styles.footerValue, { color: expenseColor }]}>
              −{formatAmount(monthTotals?.expense ?? data.plannedOutflows, baseCurrency)}
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
              {formatAmount(monthTotals ? monthTotals.net : data.amount, baseCurrency)}
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
        accessibilityLabel={`Disponible estimé : ${formatAmount(data.amount, baseCurrency)}`}
        accessibilityHint="Ouvre le détail du calcul du solde disponible."
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
    borderCurve: "continuous",
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderCurve: "continuous",
  },
  fullWidthSummaryCard: {
    marginHorizontal: 0,
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
  summaryLoading: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
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
    maxWidth: "100%",
  },
});
