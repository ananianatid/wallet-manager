import { Delete } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, useTheme } from "@/theme";

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
] as const;

interface PinDotsProps {
  length: number;
  total: number;
}

export function PinDots({ length, total }: PinDotsProps) {
  const theme = useTheme();
  return (
    <View style={styles.dots} accessibilityLabel={`${length} chiffres sur ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index < length ? theme.accent : theme.surfaceElevated,
              borderColor: theme.outline,
            },
          ]}
        />
      ))}
    </View>
  );
}

interface PinKeypadProps {
  onKey: (digit: string) => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}

export function PinKeypad({ onKey, onDelete, deleteDisabled = false }: PinKeypadProps) {
  const theme = useTheme();
  const keys = [
    ...ROWS.flatMap((row) => row),
    "",
    "0",
    "del",
  ];
  return (
    <View style={styles.keypad}>
      {keys.map((key, index) => {
        if (key === "del") {
          return (
            <Pressable
              key={key}
              onPress={onDelete}
              disabled={deleteDisabled}
              accessibilityRole="button"
              accessibilityLabel="Effacer"
              style={({ pressed }) => [
                styles.key,
                (pressed || deleteDisabled) && styles.pressed,
              ]}
            >
              <Delete size={26} strokeWidth={2} color={theme.label} />
            </Pressable>
          );
        }
        if (key === "") {
          return <View key={`empty-${index}`} style={styles.key} />;
        }
        return (
          <Pressable
            key={key}
            onPress={() => onKey(key)}
            accessibilityRole="button"
            accessibilityLabel={key}
            style={({ pressed }) => [styles.key, pressed && styles.pressed]}
          >
            <Text style={[styles.digit, { color: theme.label }]}>{key}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 300,
    alignSelf: "center",
    justifyContent: "center",
  },
  key: {
    width: 84,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.5 },
  digit: {
    fontSize: 26,
    fontWeight: "600",
    width: 64,
    height: 56,
    textAlign: "center",
    lineHeight: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
});
