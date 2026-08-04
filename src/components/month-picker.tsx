import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text } from "react-native";
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
  const [session, setSession] = useState(0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setSession((s) => s + 1)}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Fermer"
      >
        <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}>
          <Text style={[styles.sheetTitle, { color: theme.label }]}>
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
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
});
