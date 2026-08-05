import { ChevronRight, Coins, Menu, Minus, Pencil, Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";

export function LegacyRow({
  children,
  onPress,
  right,
  disabled = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  right?: ReactNode;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderBottomColor: theme.separator },
        pressed && onPress ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={styles.rowContent}>{children}</View>
      {right}
    </Pressable>
  );
}

export function LegacyTextRow({
  label,
  onPress,
  right,
}: {
  label: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <LegacyRow
      onPress={onPress}
      right={right ?? <ChevronRight size={22} color={theme.secondaryLabel} strokeWidth={2} />}
    >
      <Text style={[styles.rowLabel, { color: theme.label }]}>{label}</Text>
    </LegacyRow>
  );
}

export function LegacySectionHeader({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.sectionHeader, { backgroundColor: theme.surfaceMuted, borderBottomColor: theme.separator }]}>
      <Text style={[styles.sectionLabel, { color: theme.secondaryLabel }]}>{children}</Text>
    </View>
  );
}

export function LegacyCoinsIcon({ destructive = false }: { destructive?: boolean }) {
  const theme = useTheme();
  return destructive ? (
    <View style={[styles.minusCircle, { backgroundColor: theme.expense }]}>
      <Minus size={22} color={theme.onAccent} strokeWidth={3.5} />
    </View>
  ) : (
    <Coins size={28} color={theme.secondaryLabel} strokeWidth={1.8} />
  );
}

export function LegacyGroupActions({
  onEdit,
  onMenu,
}: {
  onEdit?: () => void;
  onMenu?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityLabel="Modifier le groupe"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onEdit}
        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
      >
        <Pencil size={22} color={theme.secondaryLabel} strokeWidth={2} />
      </Pressable>
      <Pressable
        accessibilityLabel="Réorganiser le groupe"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onMenu}
        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
      >
        <Menu size={22} color={theme.secondaryLabel} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

export function LegacyPlus({ onPress, label = "Ajouter" }: { onPress: () => void; label?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Plus size={22} color={theme.accent} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  rowContent: {
    flex: 1,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionHeader: {
    minHeight: 48,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  actionButton: {
    minWidth: 34,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  minusCircle: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  pressed: {
    opacity: 0.55,
  },
  disabled: {
    opacity: 0.5,
  },
});
