import { ChevronRight } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography, useTheme, withAlpha } from "@/theme";
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
        <>
          <View style={styles.summaryHeading}>
            <View style={styles.titleBlock}>
              <Text style={{ color: cardLabel, fontSize: 12, fontWeight: "700" }}>
                BILAN DE LA PÉRIODE
              </Text>
              <Text selectable style={[styles.summaryNet, { color: theme.accentSurfaceText }]}>
                {formatAmount(totals.net, baseCurrency)}
              </Text>
            </View>
            <Text style={{ color: cardLabel, fontSize: 12 }}>{totalLabel}</Text>
          </View>
          <View style={[styles.summaryFooter, { borderTopColor: withAlpha(cardLabel, "55") }]}>
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
            <Text style={{ color: cardLabel, fontSize: 11 }}>Écart</Text>
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
        </>
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
  const currentAmount = data.currentAvailable;
  const isNegative = currentAmount < 0;
  const forecastIsNegative = data.amount < 0;
  const forecastMatchesCurrent = data.amount === currentAmount;
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
          <Text style={{ color: cardLabel, fontSize: 13, fontWeight: "600" }}>
            PATRIMOINE DISPONIBLE
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
        {formatAmount(currentAmount, baseCurrency)}
      </Text>

      {!compact ? (
        <Text style={{ color: cardLabel, fontSize: 13, fontWeight: "600" }}>
          Disponible maintenant, avant les échéances
        </Text>
      ) : null}

      {compact ? (
        <View style={[styles.compactForecast, { borderTopColor: withAlpha(cardLabel, "66") }]}>
          <View style={styles.compactForecastHeader}>
            <Text style={{ color: cardLabel, fontSize: 11, fontWeight: "600", letterSpacing: 0.4 }}>
              APRÈS LES ÉCHÉANCES
            </Text>
            {forecastMatchesCurrent ? (
              <Text style={{ color: cardText, fontSize: 13, fontWeight: "600" }}>
                Identique au solde actuel
              </Text>
            ) : (
              <Text
                style={{
                  color: forecastIsNegative ? expenseColor : cardText,
                  fontSize: 15,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatAmount(data.amount, baseCurrency)}
              </Text>
            )}
          </View>
          {data.plannedIncome > 0 || data.plannedOutflows > 0 ? (
            <Text style={{ color: cardLabel, fontSize: 12 }}>
              {data.plannedIncome > 0 ? `+${formatAmount(data.plannedIncome, baseCurrency)} à venir` : ""}
              {data.plannedIncome > 0 && data.plannedOutflows > 0 ? " · " : ""}
              {data.plannedOutflows > 0 ? `−${formatAmount(data.plannedOutflows, baseCurrency)} prévues` : ""}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!compact && (data.plannedIncome > 0 || data.plannedOutflows > 0) ? (
        <View style={styles.forecastLine}>
          <Text style={{ color: cardLabel, fontSize: 12 }}>
            Prévision :
          </Text>
          {data.plannedIncome > 0 ? (
            <Text style={{ color: incomeColor, fontSize: 12, fontWeight: "600" }}>
              +{formatAmount(data.plannedIncome, baseCurrency)} à venir
            </Text>
          ) : null}
          {data.plannedOutflows > 0 ? (
            <Text style={{ color: expenseColor, fontSize: 12, fontWeight: "600" }}>
              −{formatAmount(data.plannedOutflows, baseCurrency)} prévues
            </Text>
          ) : null}
        </View>
      ) : null}

      {data.balanceBeforeCalculation != null && !compact ? (
        <Text style={{ color: cardLabel, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
          Solde avant calcul : {formatAmount(data.balanceBeforeCalculation, baseCurrency)}
        </Text>
      ) : null}

      {forecastIsNegative && !compact ? (
        <Text style={{ color: cardLabel, lineHeight: 18 }}>
          Prévision déficitaire : il manque {formatAmount(Math.abs(data.amount), baseCurrency)} après les échéances prévues.
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
        accessibilityLabel={`Patrimoine disponible maintenant : ${formatAmount(currentAmount, baseCurrency)}. Prévision après échéances : ${formatAmount(data.amount, baseCurrency)}`}
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
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderCurve: "continuous",
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
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
    ...typography.amount,
    fontVariant: ["tabular-nums"],
  },
  compactAmount: {
    fontSize: 38,
    lineHeight: 44,
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
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryNet: {
    marginTop: spacing.xs,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  summaryLoading: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  forecastLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  compactForecast: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  compactForecastHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 24,
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
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    maxWidth: "100%",
  },
});
