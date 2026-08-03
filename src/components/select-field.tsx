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
import { radius, spacing, useTheme } from "@/theme";

export interface SelectOption {
  id: number;
  label: string;
}

interface Props {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (id: number) => void;
}

export function SelectField({ label, value, options, onChange }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const select = (id: number) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.secondaryLabel }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.surface, borderColor: theme.separator },
          pressed && { opacity: 0.7 },
        ]}
      >
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
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => select(item.id)}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: pressed ? theme.surface : "transparent" },
                  ]}
                >
                  <Text style={{ color: theme.label, flex: 1 }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.id ===
                  options.find((o) => o.label === value)?.id ? (
                    <Check size={18} strokeWidth={2.4} color={theme.accent} />
                  ) : null}
                </Pressable>
              )}
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
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
