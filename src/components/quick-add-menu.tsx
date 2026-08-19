import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, PiggyBank, Plus, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { radius, spacing, useTheme, withAlpha } from "@/theme";
import { AnimatedPressable, motion, useReduceMotion } from "@/components/motion";

interface QuickAddMenuProps {
  visible: boolean;
  onClose: () => void;
}

const ACTIONS = [
  { label: "Dépense", type: "expense", icon: ArrowDownLeft },
  { label: "Revenu", type: "income", icon: ArrowUpRight },
  { label: "Transfert", type: "transfer", icon: ArrowLeftRight },
] as const;

export function QuickAddMenu({ visible, onClose }: QuickAddMenuProps) {
  const theme = useTheme();
  const reducedMotion = useReduceMotion();
  const [overlayOpacity] = useState(() => new Animated.Value(0));
  const [sheetTranslateY] = useState(() => new Animated.Value(48));

  useEffect(() => {
    if (!visible) {
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(48);
      return;
    }

    overlayOpacity.setValue(reducedMotion ? 1 : 0);
    sheetTranslateY.setValue(reducedMotion ? 0 : 48);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: reducedMotion ? 0 : motion.overlay,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: reducedMotion ? 0 : motion.entrance,
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlayOpacity, reducedMotion, sheetTranslateY, visible]);

  const openTransaction = (type: (typeof ACTIONS)[number]["type"]) => {
    onClose();
    router.push({ pathname: "/new-transaction", params: { type } });
  };

  const openSavings = () => {
    onClose();
    router.push("/savings");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Fermer" />
        <Animated.View style={[styles.sheet, { backgroundColor: theme.surface, transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.title, { color: theme.label }]}>Ajouter</Text>
              <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Choisissez une action</Text>
            </View>
            <AnimatedPressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer le menu d’ajout"
              style={[styles.close, { backgroundColor: theme.surfaceMuted }]}
            >
              <X size={20} color={theme.label} />
            </AnimatedPressable>
          </View>
          <View style={styles.actions}>
            {ACTIONS.map(({ label, type, icon: Icon }) => (
              <AnimatedPressable
                key={type}
                onPress={() => openTransaction(type)}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter un ${label.toLowerCase()}`}
                style={[styles.action, { borderColor: theme.separator }]}
              >
                <View style={[styles.icon, { backgroundColor: withAlpha(type === "expense" ? theme.expense : type === "income" ? theme.income : theme.accent, "18") }]}>
                  <Icon size={20} color={type === "expense" ? theme.expense : type === "income" ? theme.income : theme.accent} />
                </View>
                <Text style={[styles.actionLabel, { color: theme.label }]}>{label}</Text>
              </AnimatedPressable>
            ))}
            <AnimatedPressable
              onPress={openSavings}
              accessibilityRole="button"
              accessibilityLabel="Configurer une épargne"
              style={[styles.action, { borderColor: theme.separator }]}
            >
              <View style={[styles.icon, { backgroundColor: withAlpha(theme.income, "18") }]}>
                <PiggyBank size={20} color={theme.income} />
              </View>
              <Text style={[styles.actionLabel, { color: theme.label }]}>Épargne</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export function AddFab({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const theme = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ajouter"
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
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.32)" },
  dismiss: { flex: 1 },
  sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, gap: spacing.lg },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { marginTop: 2, fontSize: 13 },
  close: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  action: { width: "48%", minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  fab: { position: "absolute", right: spacing.lg, width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 28, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 5 },
  fabPressed: { opacity: 0.82, transform: [{ scale: 0.95 }] },
  pressed: { opacity: 0.68 },
});
