import { Plus } from "lucide-react-native";
import { StyleSheet } from "react-native";
import { AnimatedPressable } from "@/components/motion";
import { spacing, useTheme } from "@/theme";

export function AddFab({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ajouter une opération"
      accessibilityHint="Ouvre les actions pour ajouter une opération."
      style={[
        styles.fab,
        { backgroundColor: theme.accent, bottom, shadowColor: theme.label },
      ]}
    >
      <Plus size={26} strokeWidth={2.5} color={theme.onAccent} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: { position: "absolute", right: spacing.lg, width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 28, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 5 },
});
