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

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <View
        accessibilityRole="tablist"
          style={[
            styles.bar,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: withAlpha(theme.label, "16"),
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
                focused && { backgroundColor: withAlpha(theme.accent, "1F") },
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
  },
  bar: {
    width: "100%",
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 2,
    borderRadius: 999,
    borderCurve: "continuous",
  },
  label: {
    maxWidth: "100%",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: -0.15,
  },
  labelFocused: {
    fontWeight: "800",
  },
});
