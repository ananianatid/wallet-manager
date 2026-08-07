import { Check, X } from "lucide-react-native";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  CATEGORY_ICON_LABELS,
  CATEGORY_ICON_NAMES,
  type CategoryIconName,
} from "@/constants/category-icons";
import { CategoryIcon } from "@/components/category-icons";
import { radius, spacing, useTheme } from "@/theme";

interface Props {
  visible: boolean;
  value: CategoryIconName;
  onSelect: (icon: CategoryIconName) => void;
  onClose: () => void;
}

export function CategoryIconPicker({ visible, value, onSelect, onClose }: Props) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}>
          <View style={styles.header}>
            <Text style={{ color: theme.label, fontSize: 17, fontWeight: "800" }}>
              Choisir une icône
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fermer le choix d’icône"
            >
              <X size={21} strokeWidth={2.2} color={theme.secondaryLabel} />
            </Pressable>
          </View>
          <FlatList
            data={CATEGORY_ICON_NAMES}
            numColumns={4}
            keyExtractor={(icon) => icon}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => {
              const selected = item === value;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={CATEGORY_ICON_LABELS[item]}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected ? theme.accent : theme.surface,
                      borderColor: selected ? theme.accent : theme.separator,
                    },
                    pressed && { opacity: 0.65 },
                  ]}
                >
                  <CategoryIcon
                    name={item}
                    size={22}
                    strokeWidth={2.1}
                    color={selected ? theme.onAccent : theme.label}
                  />
                  <Text
                    numberOfLines={1}
                    style={{ color: selected ? theme.onAccent : theme.secondaryLabel, fontSize: 10 }}
                  >
                    {CATEGORY_ICON_LABELS[item]}
                  </Text>
                  {selected ? (
                    <View style={[styles.check, { backgroundColor: theme.surfaceElevated }]}>
                      <Check size={11} strokeWidth={3} color={theme.accent} />
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "78%",
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
  },
  grid: {
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    minWidth: 72,
    minHeight: 70,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    margin: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  check: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
});
