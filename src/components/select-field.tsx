import { MenuView } from "@expo/ui/community/menu";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  const actions = options.map((o) => ({
    title: o.label,
    id: String(o.id),
  }));

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.secondaryLabel }]}>{label}</Text>
      <MenuView
        actions={actions}
        onPressAction={(e) => onChange(Number(e.nativeEvent.event))}
      >
        <Pressable
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
          <Text style={{ color: theme.secondaryLabel }}>▾</Text>
        </Pressable>
      </MenuView>
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
});
