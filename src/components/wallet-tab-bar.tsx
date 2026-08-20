import {
  BarChart3,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  WalletCards,
  type LucideIcon,
} from "lucide-react-native";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddFab } from "@/components/quick-add-menu";
import { radius, spacing, useTheme, withAlpha } from "@/theme";

interface TabDefinition {
  label: string;
  icon: LucideIcon;
}

const TAB_ORDER = ["(dashboard)", "(transactions)", "(plans)", "(statistics)", "(accounts)"];
const TAB_DEFINITIONS: Record<string, TabDefinition> = {
  "(dashboard)": { label: "Accueil", icon: LayoutDashboard },
  "(transactions)": { label: "Activité", icon: ReceiptText },
  "(plans)": { label: "Planification", icon: PiggyBank },
  "(statistics)": { label: "Statistiques", icon: BarChart3 },
  "(accounts)": { label: "Comptes", icon: WalletCards },
};

export function WalletTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes
    .filter((route) => TAB_ORDER.includes(route.name))
    .sort((a, b) => TAB_ORDER.indexOf(a.name) - TAB_ORDER.indexOf(b.name));

  const renderTab = (route: (typeof routes)[number]) => {
    const focused = state.routes[state.index]?.key === route.key;
    const definition = TAB_DEFINITIONS[route.name];
    const options = descriptors[route.key]?.options;
    const label = typeof options?.tabBarLabel === "string" ? options.tabBarLabel : definition.label;
    const Icon = definition.icon;
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (event.defaultPrevented) return;
      if (focused) {
        const childStateKey = route.state?.key;
        if (childStateKey) navigation.dispatch({ type: "POP_TO_TOP", target: childStateKey });
        return;
      }
      navigation.navigate(route.name, route.params);
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
        accessibilityRole="tab"
        accessibilityLabel={`${label}${focused ? ", onglet sélectionné" : ""}`}
        accessibilityState={{ selected: focused }}
        style={({ pressed }) => [styles.item, focused && { backgroundColor: withAlpha(theme.accent, "12") }, pressed && styles.pressed]}
      >
        <Icon size={18} strokeWidth={focused ? 2.5 : 2} color={focused ? theme.accent : theme.secondaryLabel} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.label, { color: focused ? theme.accent : theme.secondaryLabel }, focused && styles.labelFocused]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      <View style={[styles.host, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <View accessibilityRole="tablist" accessibilityLabel="Navigation principale" style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          {routes.map(renderTab)}
        </View>
        <AddFab
          onPress={() => router.push("/new-transaction")}
          bottom={Math.max(insets.bottom, spacing.sm) + 80}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  host: { width: "100%", paddingTop: spacing.sm, position: "relative" },
  bar: { minHeight: 72, flexDirection: "row", alignItems: "center", marginHorizontal: spacing.sm, padding: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.xl, overflow: "visible" },
  item: { flex: 1, minWidth: 0, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2, borderRadius: radius.lg },
  label: { maxWidth: "100%", fontSize: 10, fontWeight: "500", letterSpacing: -0.1, textAlign: "center" },
  labelFocused: { fontWeight: "700" },
  pressed: { opacity: 0.68 },
});
