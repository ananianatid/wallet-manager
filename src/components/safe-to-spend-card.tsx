import { ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";
import type { SafeToSpend } from "@/types";
import { formatAmount } from "@/utils/format";

interface Props {
  data: SafeToSpend;
  onPress?: () => void;
  interactive?: boolean;
}

export function SafeToSpendCard({ data, onPress, interactive = true }: Props) {
  const theme = useTheme();
  const isNegative = data.amount < 0;
  const accent = isNegative ? theme.expense : theme.accent;

  const content = (
    <>
      <View style={styles.heading}>
        <View style={styles.titleBlock}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13, fontWeight: "700" }}>
            DISPONIBLE ESTIMÉ
          </Text>
        </View>
        {interactive && onPress ? (
          <ChevronRight size={18} strokeWidth={2.2} color={theme.secondaryLabel} />
        ) : null}
      </View>

      <Text style={[styles.amount, { color: accent }]} selectable>
        {formatAmount(data.amount)}
      </Text>

      {isNegative ? (
        <Text style={{ color: theme.expense, lineHeight: 18 }}>
          Il manque {formatAmount(Math.abs(data.amount))} pour couvrir les échéances prévues.
        </Text>
      ) : null}

      {interactive ? (
      <View style={[styles.footer, { borderTopColor: theme.separator }]}>
        <View style={styles.footerItem}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 11 }}>Revenus</Text>
          <Text
            style={[
              styles.footerValue,
              { color: theme.income },
            ]}
          >
            + {formatAmount(data.plannedIncome)}
          </Text>
        </View>
        <View style={[styles.footerItem, styles.footerItemCenter]}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 11 }}>Dépenses</Text>
          <Text style={[styles.footerValue, { color: theme.expense }]}>
            −{formatAmount(data.plannedOutflows)}
          </Text>
        </View>
        <View style={[styles.footerItem, styles.footerItemRight]}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 11 }}>Solde</Text>
          <Text
            style={[
              styles.footerValue,
              { color: data.amount >= 0 ? theme.label : theme.expense },
            ]}
          >
            {formatAmount(data.amount)}
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
          { backgroundColor: theme.surface },
          pressed && { opacity: 0.7 },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, { backgroundColor: theme.surface }]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
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
  footer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
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
