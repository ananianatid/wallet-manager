import {
  ChartBar,
  LayoutDashboard,
  ReceiptText,
  Settings,
  WalletCards,
  type LucideIcon,
} from "lucide-react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme, withAlpha } from "@/theme";

interface TabDefinition {
  label: string;
  icon: LucideIcon;
}

const TAB_DEFINITIONS: Record<string, TabDefinition> = {
  "(dashboard)": { label: "Accueil", icon: LayoutDashboard },
  "(transactions)": { label: "Transactions", icon: ReceiptText },
  "(statistics)": { label: "Statistiques", icon: ChartBar },
  "(accounts)": { label: "Comptes", icon: WalletCards },
  "(settings)": { label: "Paramètres", icon: Settings },
};

export function WalletTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
    >
      <View
        accessibilityRole="tablist"
          style={[
            styles.bar,
            {
              backgroundColor: theme.surface,
              borderColor: theme.separator,
            },
          ]}
        accessibilityLabel="Navigation principale"
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const definition = TAB_DEFINITIONS[route.name];
          const options = descriptors[route.key]?.options;
          const label =
            typeof options?.tabBarLabel === "string"
              ? options.tabBarLabel
              : definition?.label ?? route.name;
          const accessibilityLabel =
            options?.tabBarAccessibilityLabel ??
            `${label}${focused ? ", onglet sélectionné" : ""}`;
          const Icon = definition?.icon ?? LayoutDashboard;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) {
              return;
            }

            if (focused) {
              const childStateKey = route.state?.key;
              if (childStateKey) {
                navigation.dispatch({ type: "POP_TO_TOP", target: childStateKey });
              }
              return;
            }

            navigation.navigate(route.name, route.params);
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ selected: focused }}
              style={({ pressed }) => [
                styles.item,
                focused && { backgroundColor: withAlpha(theme.accent, "22") },
                pressed && { opacity: 0.68 },
              ]}
            >
              <Icon
                size={16}
                strokeWidth={focused ? 2.6 : 2.1}
                color={focused ? theme.accent : theme.secondaryLabel}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                style={[
                  styles.label,
                  { color: focused ? theme.accent : theme.secondaryLabel },
                  focused && styles.labelFocused,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
    paddingTop: spacing.sm,
  },
  bar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.sm,
    width: "auto",
    padding: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    overflow: "hidden",
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 2,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  label: {
    maxWidth: "100%",
    fontSize: 10.5,
    fontWeight: "500",
    letterSpacing: -0.15,
  },
  labelFocused: {
    fontWeight: "600",
  },
});
