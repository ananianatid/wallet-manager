import { AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";
import type { SafeToSpend } from "@/types";
import { formatAmount, formatDate } from "@/utils/format";

interface Props {
  data: SafeToSpend;
  onPress: () => void;
}

export function SafeToSpendCard({ data, onPress }: Props) {
  const theme = useTheme();
  const isNegative = data.amount < 0;
  const accent = isNegative ? theme.expense : theme.accent;
  const horizonLabel = data.usesFallbackHorizon
    ? "sur les 30 prochains jours"
    : "jusqu'au prochain revenu";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: isNegative ? `${theme.expense}22` : `${theme.accent}22` }]}>
          {isNegative ? (
            <AlertTriangle size={17} strokeWidth={2.2} color={accent} />
          ) : (
            <ShieldCheck size={17} strokeWidth={2.2} color={accent} />
          )}
        </View>
        <View style={styles.titleBlock}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13, fontWeight: "700" }}>
            DÉPENSABLE SANS RISQUE
          </Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
            {horizonLabel} · {formatDate(data.horizonDate)}
          </Text>
        </View>
        <ChevronRight size={18} strokeWidth={2.2} color={theme.secondaryLabel} />
      </View>

      <Text style={[styles.amount, { color: accent }]} selectable>
        {formatAmount(data.amount)}
      </Text>

      {isNegative ? (
        <Text style={{ color: theme.expense, lineHeight: 18 }}>
          Il manque {formatAmount(Math.abs(data.amount))} pour couvrir les échéances prévues.
        </Text>
      ) : (
        <Text style={{ color: theme.secondaryLabel, lineHeight: 18 }}>
          Après les réservations et les échéances prévues.
        </Text>
      )}

      <View style={[styles.footer, { borderTopColor: theme.separator }]}>
        <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
          Voir le calcul détaillé
        </Text>
        <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
          {data.eventCount} élément{data.eventCount > 1 ? "s" : ""} prévu{data.eventCount > 1 ? "s" : ""}
        </Text>
      </View>
    </Pressable>
  );
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
  icon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  amount: {
    fontSize: 28,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
