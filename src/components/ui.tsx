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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
      ? theme.accentSurface
      : variant === "destructive"
        ? withAlpha(theme.expense, "18")
        : theme.surface;
  const labelColor =
    variant === "primary"
      ? theme.accentSurfaceText
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
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled, selected }}
      style={({ pressed }) => [
        styles.iconButton,
        selected && {
          backgroundColor: withAlpha(theme.accent, "18"),
          borderRadius: radius.md,
        },
        (pressed || disabled) && styles.pressed,
      ]}
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
      accessibilityRole={isError ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      accessible={isError ? !onRetry : true}
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
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessible={!onRetry}
    >
      <Text style={[styles.inlineErrorText, { color: theme.expense }]}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Réessayer"
          accessibilityHint="Relance le chargement."
          style={styles.inlineRetry}
        >
          <Text style={[styles.inlineRetryText, { color: theme.expense }]}>Réessayer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface KeyboardAwareViewProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function KeyboardAwareView({ children, style }: KeyboardAwareViewProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {children}
    </KeyboardAvoidingView>
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
  const insets = useSafeAreaInsets();
  const { style, ...restScrollProps } = scrollProps;
  return (
    <KeyboardAwareView>
      <ScrollView
        {...restScrollProps}
        style={[styles.flex, style]}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.keyboardContent,
          contentContainerStyle,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
      >
        {children}
      </ScrollView>
    </KeyboardAwareView>
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
    borderCurve: "continuous",
  },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
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
  inlineRetry: { minHeight: 48, justifyContent: "center" },
  inlineRetryText: { fontWeight: "800", lineHeight: 18 },
  keyboardContent: { paddingBottom: spacing.xxl },
});
