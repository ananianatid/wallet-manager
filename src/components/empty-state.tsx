import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";

interface Props {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: theme.accent }]} />
      <Text style={[styles.title, { color: theme.label }]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, { color: theme.secondaryLabel }]}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.buttonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    marginTop: spacing.sm,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
  },
  buttonLabel: {
    color: "#0A0A0B",
    fontWeight: "700",
  },
});
