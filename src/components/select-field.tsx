import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIcon } from "@/components/category-icons";
import type { CategoryIconName } from "@/constants/category-icons";
import { radius, spacing, useTheme, withAlpha } from "@/theme";

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
  layout?: "list" | "grid";
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  layout = "list",
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selectedId = options.find((o) => o.label === value)?.id;
  const selectedOption = options.find((o) => o.id === selectedId);

  const select = (id: number) => {
    Keyboard.dismiss();
    onChange(id);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      {!hideLabel ? (
        <Text style={[styles.label, { color: theme.secondaryLabel }]}>{label}</Text>
      ) : null}
      <Pressable
        disabled={options.length === 0}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityState={{ disabled: options.length === 0 }}
        accessibilityValue={{ text: value ?? "Aucune sélection" }}
        accessibilityHint="Ouvre la liste des options."
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.surface, borderColor: theme.separator },
          (pressed || options.length === 0) && { opacity: 0.55 },
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
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.scrim }]}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          accessibilityHint="Ferme la liste sans modifier la sélection."
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surfaceElevated,
                paddingBottom: spacing.xl + insets.bottom,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.separator }]} />
            <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.label }]}>
              {label}
            </Text>
            <FlatList
              data={options}
              numColumns={layout === "grid" ? 2 : 1}
              keyExtractor={(o) => String(o.id)}
              columnWrapperStyle={layout === "grid" ? styles.gridRow : undefined}
              contentContainerStyle={[styles.options, layout === "grid" && styles.gridOptions]}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: theme.secondaryLabel }]}>
                  Aucune option disponible.
                </Text>
              }
              renderItem={({ item }) => {
                const selected = item.id === selectedId;
                return (
                  <Pressable
                    onPress={() => select(item.id)}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.option,
                      layout === "grid" && styles.gridOption,
                      {
                        backgroundColor: selected ? theme.accent : theme.surface,
                        borderColor: selected ? theme.accent : theme.separator,
                      },
                      pressed && { opacity: 0.65 },
                    ]}
                  >
                    {item.icon ? (
                      <View
                        style={[
                          styles.optionIcon,
                          {
                            backgroundColor: selected
                              ? withAlpha(theme.onAccent, "1F")
                              : theme.surfaceElevated,
                          },
                        ]}
                      >
                        <CategoryIcon
                          name={item.icon}
                          size={20}
                          strokeWidth={2.1}
                          color={selected ? theme.onAccent : theme.label}
                        />
                      </View>
                    ) : null}
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.optionLabel,
                        { color: selected ? theme.onAccent : theme.label },
                        layout === "grid" && styles.gridOptionLabel,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <View style={[styles.trailing, layout === "grid" && styles.gridTrailing]}>
                      {selected ? (
                        <Check size={19} strokeWidth={3} color={theme.onAccent} />
                      ) : null}
                    </View>
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
    borderCurve: "continuous",
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontWeight: "700",
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  options: {
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  gridOptions: {
    gap: spacing.sm,
  },
  gridRow: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    borderCurve: "continuous",
  },
  gridOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.lg,
    paddingVertical: spacing.sm,
  },
  optionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  gridOptionLabel: {
    flex: 1,
    textAlign: "left",
  },
  trailing: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  gridTrailing: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
  },
  empty: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    textAlign: "center",
  },
});
