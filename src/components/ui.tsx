import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { radius, spacing, useTheme, withAlpha } from "@/theme";

type ActionButtonVariant = "primary" | "secondary" | "destructive";

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ActionButtonVariant;
  accessibilityLabel?: string;
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  accessibilityLabel,
}: ActionButtonProps) {
  const theme = useTheme();
  const backgroundColor =
    variant === "primary"
      ? theme.accent
      : variant === "destructive"
        ? withAlpha(theme.expense, "18")
        : theme.surface;
  const labelColor =
    variant === "primary"
      ? theme.onAccent
      : variant === "destructive"
        ? theme.expense
        : theme.label;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor, borderColor: theme.outline },
        variant === "secondary" && styles.secondaryButton,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

interface IconButtonProps {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  hint?: string;
}

export function IconButton({
  label,
  icon,
  onPress,
  disabled = false,
  selected,
  hint,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled, selected }}
      style={({ pressed }) => [styles.iconButton, (pressed || disabled) && styles.pressed]}
    >
      {icon}
    </Pressable>
  );
}

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  labelStyle?: StyleProp<TextStyle>;
}

export function FormField({ label, hint, error, children, labelStyle }: FormFieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.secondaryLabel }, labelStyle]}>
        {label}
      </Text>
      {children}
      {hint && !error ? (
        <Text style={[styles.fieldHint, { color: theme.secondaryLabel }]}>{hint}</Text>
      ) : null}
      {error ? (
        <Text
          style={[styles.fieldError, { color: theme.expense }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface ScreenStateProps {
  status: "loading" | "error";
  message?: string;
  onRetry?: () => void;
}

export function ScreenState({ status, message, onRetry }: ScreenStateProps) {
  const theme = useTheme();
  const isError = status === "error";
  return (
    <View
      style={styles.screenState}
      accessible
      accessibilityRole={isError ? "alert" : undefined}
      accessibilityLiveRegion="polite"
    >
      {isError ? null : <ActivityIndicator color={theme.accent} />}
      <Text style={[styles.screenStateTitle, { color: theme.label }]}> 
        {isError ? "Chargement impossible" : "Chargement…"}
      </Text>
      {isError ? (
        <>
          <Text style={[styles.screenStateMessage, { color: theme.secondaryLabel }]}> 
            {message ?? "Une erreur est survenue. Vérifiez vos données et réessayez."}
          </Text>
          {onRetry ? <ActionButton label="Réessayer" onPress={onRetry} /> : null}
        </>
      ) : null}
    </View>
  );
}

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
}

export function InlineError({ message, onRetry }: InlineErrorProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.inlineError, { backgroundColor: withAlpha(theme.expense, "16") }]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.inlineErrorText, { color: theme.expense }]}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Réessayer"
          style={styles.inlineRetry}
        >
          <Text style={[styles.inlineRetryText, { color: theme.expense }]}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface KeyboardAwareScreenProps extends Omit<ScrollViewProps, "contentContainerStyle"> {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function KeyboardAwareScreen({
  children,
  contentContainerStyle,
  ...scrollProps
}: KeyboardAwareScreenProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        {...scrollProps}
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.keyboardContent, contentContainerStyle]}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actionButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.65 },
  field: { gap: spacing.xs + 2 },
  fieldLabel: { fontSize: 13 },
  fieldHint: { fontSize: 12, lineHeight: 17 },
  fieldError: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  screenState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  screenStateTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  screenStateMessage: { textAlign: "center", lineHeight: 19 },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  inlineErrorText: { flex: 1, lineHeight: 18 },
  inlineRetry: { minHeight: 40, justifyContent: "center" },
  inlineRetryText: { fontWeight: "800" },
  keyboardContent: { paddingBottom: spacing.xxl },
});
