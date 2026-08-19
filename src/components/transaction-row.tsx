import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeftRight } from "lucide-react-native";
import { CategoryIcon } from "@/components/category-icons";
import { radius, spacing, typography, useTheme } from "@/theme";
import type { Transaction } from "@/types";
import { formatAmount, formatDate, formatTime } from "@/utils/format";

interface Props {
  transaction: Transaction;
  onPress?: () => void;
  hideDate?: boolean;
}

export function TransactionRow({ transaction, onPress, hideDate = false }: Props) {
  const theme = useTheme();
  const isIncome = transaction.type === "income";
  const isExpense = transaction.type === "expense";
  const isTransfer = transaction.type === "transfer";

  const color = isIncome ? theme.income : isExpense ? theme.accent : theme.accent;
  const amountColor = isIncome ? theme.income : theme.label;
  const title = isTransfer
    ? `${transaction.accountName} → ${transaction.destinationAccountName}`
    : (transaction.categoryName ?? "Sans catégorie");
  const dateLabel = hideDate
    ? formatTime(transaction.transactionDate)
    : `${formatDate(transaction.transactionDate)} · ${formatTime(transaction.transactionDate)}`;
  const details = [transaction.accountName, dateLabel];
  if (isTransfer && transaction.fee) {
    details.push(`Frais : ${formatAmount(transaction.fee, transaction.accountCurrencyCode)}`);
  }

  const content = (
    <>
      {isTransfer ? (
        <View style={[styles.categoryIcon, { backgroundColor: theme.surfaceElevated }]}>
          <ArrowLeftRight size={17} color={color} />
        </View>
      ) : (
        <View style={[styles.categoryIcon, { backgroundColor: theme.surfaceElevated }]}>
          <CategoryIcon name={transaction.categoryIcon} size={17} color={color} />
        </View>
      )}
      <View style={styles.body}>
        <Text
          style={[styles.title, { color: theme.label }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text style={[styles.detail, { color: theme.secondaryLabel }]} numberOfLines={1}>
          {transaction.accountName} · {dateLabel}
        </Text>
        {transaction.note ? (
          <Text style={[styles.detail, { color: theme.secondaryLabel }]} numberOfLines={1}>
            {transaction.note}
          </Text>
        ) : null}
      </View>
      <Text
        selectable
        numberOfLines={2}
        ellipsizeMode="tail"
        style={[styles.amount, { color: amountColor }]}
      >
        {isIncome ? "+" : isExpense ? "−" : ""}
        {isTransfer && transaction.destinationAmount != null && transaction.destinationCurrencyCode && transaction.destinationCurrencyCode !== transaction.accountCurrencyCode
          ? `${formatAmount(transaction.amount, transaction.accountCurrencyCode)} → ${formatAmount(transaction.destinationAmount, transaction.destinationCurrencyCode)}`
          : formatAmount(transaction.amount, transaction.accountCurrencyCode)}
      </Text>
    </>
  );

  const accessibilityLabel = `${title}. ${details.join(". ")}. ${formatAmount(transaction.amount)}`;

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={styles.row}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Ouvre la transaction pour la modifier."
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 72,
    borderCurve: "continuous",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body,
    fontWeight: "600",
    lineHeight: 20,
  },
  detail: {
    fontSize: 12,
    lineHeight: 17,
    fontVariant: ["tabular-nums"],
  },
  amount: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
