import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "@/theme";
import type { Transaction } from "@/types";
import { formatAmount, formatDate, formatTime } from "@/utils/format";

interface Props {
  transaction: Transaction;
  onPress: () => void;
  hideDate?: boolean;
}

export function TransactionRow({ transaction, onPress, hideDate = false }: Props) {
  const theme = useTheme();
  const isIncome = transaction.type === "income";
  const isExpense = transaction.type === "expense";
  const isTransfer = transaction.type === "transfer";

  const color = isIncome ? theme.income : isExpense ? theme.expense : theme.accent;
  const title = isTransfer
    ? `${transaction.accountName} → ${transaction.destinationAccountName}`
    : (transaction.categoryName ?? "Sans catégorie");
  const details = [
    transaction.accountName,
    hideDate
      ? formatTime(transaction.transactionDate)
      : `${formatDate(transaction.transactionDate)} · ${formatTime(transaction.transactionDate)}`,
  ];
  if (isTransfer && transaction.fee) {
    details.push(`Frais : ${formatAmount(transaction.fee)}`);
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.body}>
        <Text
          style={[styles.title, { color: theme.label }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={[styles.detail, { color: theme.secondaryLabel }]} numberOfLines={1}>
          {details.join(" · ")}
        </Text>
        {transaction.note ? (
          <Text style={[styles.detail, { color: theme.secondaryLabel }]} numberOfLines={1}>
            {transaction.note}
          </Text>
        ) : null}
      </View>
      <Text
        selectable
        style={[styles.amount, { color }]}
      >
        {isIncome ? "+" : isExpense ? "−" : ""}
        {formatAmount(transaction.amount)}
      </Text>
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
    borderCurve: "continuous",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: "600",
  },
  detail: {
    fontSize: 13,
  },
  amount: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
