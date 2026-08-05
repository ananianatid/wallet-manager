import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CategoryIcon } from "@/components/category-icons";
import type { CategoryIconName } from "@/constants/category-icons";
import { radius, spacing, useTheme } from "@/theme";

export interface SelectOption {
  id: number;
  label: string;
  icon?: CategoryIconName | null;
}

interface Props {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (id: number) => void;
  hideLabel?: boolean;
}

export function SelectField({ label, value, options, onChange, hideLabel = false }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selectedId = options.find((o) => o.label === value)?.id;
  const selectedOption = options.find((o) => o.id === selectedId);
  const hasIcons = options.some((o) => o.icon != null);

  const select = (id: number) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      {!hideLabel ? (
        <Text style={[styles.label, { color: theme.secondaryLabel }]}>{label}</Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: value ?? "Aucune sélection" }}
        accessibilityHint="Ouvre la liste des options."
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.surface, borderColor: theme.separator },
          pressed && { opacity: 0.7 },
        ]}
      >
        {selectedOption?.icon ? (
          <CategoryIcon name={selectedOption.icon} size={18} color={theme.accent} />
        ) : null}
        <Text
          style={{ color: value ? theme.label : theme.secondaryLabel, flex: 1 }}
          numberOfLines={1}
        >
          {value ?? "Sélectionner…"}
        </Text>
        <ChevronDown size={18} strokeWidth={2} color={theme.secondaryLabel} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Fermer"
        >
          <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.sheetTitle, { color: theme.label }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => String(o.id)}
              numColumns={hasIcons ? 4 : 3}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.grid}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const selected = item.id === selectedId;
                return hasIcons ? (
                  <Pressable
                    onPress={() => select(item.id)}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.iconOption,
                      {
                        backgroundColor: selected ? theme.accent : theme.surface,
                        borderColor: selected ? theme.accent : theme.separator,
                      },
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    {item.icon ? (
                      <CategoryIcon
                        name={item.icon}
                        size={22}
                        strokeWidth={2.1}
                        color={selected ? theme.onAccent : theme.label}
                      />
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={{
                        color: selected ? theme.onAccent : theme.secondaryLabel,
                        fontSize: 10,
                      }}
                    >
                      {item.label}
                    </Text>
                    {selected ? (
                      <View style={[styles.check, { backgroundColor: theme.surfaceElevated }]}>
                        <Check size={11} strokeWidth={3} color={theme.accent} />
                      </View>
                    ) : null}
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => select(item.id)}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.textOption,
                      {
                        backgroundColor: selected ? theme.accent : theme.surface,
                        borderColor: selected ? theme.accent : theme.separator,
                      },
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    <Text
                      numberOfLines={2}
                      style={{
                        color: selected ? theme.onAccent : theme.label,
                        fontSize: 13,
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs + 2,
  },
  label: {
    fontSize: 13,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  sheetTitle: {
    fontWeight: "700",
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  grid: {
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  gridRow: {
    gap: spacing.sm,
  },
  iconOption: {
    flex: 1,
    minWidth: 72,
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  textOption: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  check: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
});
