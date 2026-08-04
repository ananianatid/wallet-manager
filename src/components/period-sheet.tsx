import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MonthGridPicker } from "@/components/month-grid-picker";
import { radius, spacing, useTheme } from "@/theme";
import type { MonthRef } from "@/utils/statistics";

interface Props {
  visible: boolean;
  start: MonthRef;
  end: MonthRef;
  years: number[];
  onChange: (start: MonthRef, end: MonthRef) => void;
  onClose: () => void;
}

const monthIndex = (ref: MonthRef) => ref.year * 12 + ref.month;

export function PeriodSheet({ visible, start, end, years, onChange, onClose }: Props) {
  const theme = useTheme();
  const [session, setSession] = useState(0);

  const pickStart = (year: number, month: number) => {
    const next = { year, month };
    onChange(next, monthIndex(next) > monthIndex(end) ? next : end);
  };

  const pickEnd = (year: number, month: number) => {
    const next = { year, month };
    onChange(monthIndex(next) < monthIndex(start) ? next : start, next);
  };

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
            Choisir la période
          </Text>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryLabel }]}>
              Du
            </Text>
            <MonthGridPicker
              key={`start-${session}`}
              years={years}
              selectedYear={start.year}
              selectedMonth={start.month}
              onSelect={pickStart}
              yearsMaxHeight={170}
            />
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: theme.separator },
            ]}
          />

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.secondaryLabel }]}>
              Au
            </Text>
            <MonthGridPicker
              key={`end-${session}`}
              years={years}
              selectedYear={end.year}
              selectedMonth={end.month}
              onSelect={pickEnd}
              yearsMaxHeight={170}
            />
          </View>
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
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.lg,
  },
});
