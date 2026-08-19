import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, PiggyBank, Plus, X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { radius, spacing, useTheme, withAlpha } from "@/theme";

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
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.title, { color: theme.label }]}>Ajouter</Text>
              <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Choisissez une action</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer le menu d’ajout"
              style={({ pressed }) => [styles.close, { backgroundColor: theme.surfaceMuted }, pressed && styles.pressed]}
            >
              <X size={20} color={theme.label} />
            </Pressable>
          </View>
          <View style={styles.actions}>
            {ACTIONS.map(({ label, type, icon: Icon }) => (
              <Pressable
                key={type}
                onPress={() => openTransaction(type)}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter un ${label.toLowerCase()}`}
                style={({ pressed }) => [styles.action, { borderColor: theme.separator }, pressed && styles.pressed]}
              >
                <View style={[styles.icon, { backgroundColor: withAlpha(type === "expense" ? theme.expense : type === "income" ? theme.income : theme.accent, "18") }]}>
                  <Icon size={20} color={type === "expense" ? theme.expense : type === "income" ? theme.income : theme.accent} />
                </View>
                <Text style={[styles.actionLabel, { color: theme.label }]}>{label}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={openSavings}
              accessibilityRole="button"
              accessibilityLabel="Configurer une épargne"
              style={({ pressed }) => [styles.action, { borderColor: theme.separator }, pressed && styles.pressed]}
            >
              <View style={[styles.icon, { backgroundColor: withAlpha(theme.income, "18") }]}>
                <PiggyBank size={20} color={theme.income} />
              </View>
              <Text style={[styles.actionLabel, { color: theme.label }]}>Épargne</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function AddFab({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ajouter"
      accessibilityHint="Ouvre les actions pour ajouter une opération."
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: theme.accent, bottom, shadowColor: theme.label },
        pressed && styles.fabPressed,
      ]}
    >
      <Plus size={26} strokeWidth={2.5} color={theme.onAccent} />
    </Pressable>
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
