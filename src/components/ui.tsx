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
import { radius, spacing, typography, useTheme, withAlpha } from "@/theme";

type ActionButtonVariant = "primary" | "secondary" | "destructive";

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ActionButtonVariant;
  accessibilityLabel?: string;
}

interface ContentSectionProps {
  title: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
}

export function ContentSection({ title, action, children }: ContentSectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.contentSection, { borderTopColor: theme.separator }]}>
      <View style={styles.contentSectionHeader}>
        <Text accessibilityRole="header" style={[styles.contentSectionTitle, { color: theme.label }]}>
          {title}
        </Text>
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [styles.contentSectionAction, pressed && styles.pressed]}
          >
            <Text style={[styles.contentSectionActionLabel, { color: theme.accent }]}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.contentSectionBody}>{children}</View>
    </View>
  );
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
        : theme.surfaceElevated;
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
        { backgroundColor, borderColor: variant === "secondary" ? theme.outline : backgroundColor },
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
  contentSection: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  contentSectionHeader: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  contentSectionTitle: {
    flex: 1,
    ...typography.section,
  },
  contentSectionAction: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  contentSectionActionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  contentSectionBody: {
    gap: spacing.md,
  },
  actionButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
  },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    fontSize: 15,
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
  fieldLabel: { ...typography.label },
  fieldHint: { fontSize: 12, lineHeight: 17 },
  fieldError: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  screenState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  screenStateTitle: { ...typography.section, textAlign: "center" },
  screenStateMessage: { ...typography.body, textAlign: "center" },
  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  inlineErrorText: { flex: 1, lineHeight: 18 },
  inlineRetry: { minHeight: 48, justifyContent: "center" },
  inlineRetryText: { fontWeight: "600", lineHeight: 18 },
  keyboardContent: { paddingBottom: spacing.xxl },
});
