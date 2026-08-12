import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MonthGridPicker } from "@/components/month-grid-picker";
import { radius, spacing, useTheme } from "@/theme";

interface Props {
  visible: boolean;
  year: number;
  month: number;
  years: number[];
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}

export function MonthPicker({ visible, year, month, years, onSelect, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState(0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setSession((s) => s + 1)}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        accessibilityHint="Ferme le sélecteur de mois."
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
            Choisir un mois
          </Text>
          <MonthGridPicker
            key={session}
            years={years}
            selectedYear={year}
            selectedMonth={month}
            onSelect={(y, m) => {
              onSelect(y, m);
              onClose();
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sheetTitle: {
    fontWeight: "700",
    fontSize: 16,
    paddingBottom: spacing.md,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
});
