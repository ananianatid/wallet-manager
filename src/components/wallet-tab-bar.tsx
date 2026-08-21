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
import { useEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddFab } from "@/components/quick-add-menu";
import { getTabAnimation, motion, useReduceMotion } from "@/components/motion";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
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

export function getActiveTabIndex(
  routes: readonly { key: string }[],
  activeRouteKey: string | undefined,
): number | null {
  if (!activeRouteKey) return null;
  const index = routes.findIndex((route) => route.key === activeRouteKey);
  return index >= 0 ? index : null;
}

export function getAvailableTabBarWidth(barWidth: number, horizontalInset = spacing.xs): number {
  return Math.max(0, barWidth - horizontalInset * 2);
}

export function getIndicatorMetrics(
  availableWidth: number,
  tabCount: number,
  activeIndex: number,
): { cellWidth: number; translateX: number } {
  "worklet";
  if (availableWidth <= 0 || tabCount <= 0) {
    return { cellWidth: 0, translateX: 0 };
  }
  const cellWidth = availableWidth / tabCount;
  return { cellWidth, translateX: cellWidth * activeIndex };
}

export function shouldAnimateTabIndicator(platform: string, reducedMotion: boolean): boolean {
  return getTabAnimation(platform, reducedMotion) === "shift";
}

export function WalletTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReduceMotion();
  const routes = state.routes
    .filter((route) => TAB_ORDER.includes(route.name))
    .sort((a, b) => TAB_ORDER.indexOf(a.name) - TAB_ORDER.indexOf(b.name));
  const activeRouteKey = state.routes[state.index]?.key;
  const activeIndex = getActiveTabIndex(routes, activeRouteKey);
  const activeIndexValue = useSharedValue(activeIndex ?? 0);
  const availableWidth = useSharedValue(0);
  const didInitializeActiveIndex = useRef(false);
  const shouldAnimateIndicator = shouldAnimateTabIndicator(Platform.OS, reducedMotion);

  useEffect(() => {
    if (activeIndex === null) return;

    if (!didInitializeActiveIndex.current) {
      activeIndexValue.value = activeIndex;
      didInitializeActiveIndex.current = true;
      return;
    }

    activeIndexValue.value =
      shouldAnimateIndicator
        ? withTiming(activeIndex, {
            duration: motion.standard,
            easing: Easing.out(Easing.cubic),
          })
        : activeIndex;
  }, [activeIndex, activeIndexValue, shouldAnimateIndicator]);

  const onBarLayout = (event: LayoutChangeEvent) => {
    availableWidth.value = getAvailableTabBarWidth(event.nativeEvent.layout.width);
  };

  const indicatorStyle = useAnimatedStyle(
    () => {
      const { cellWidth, translateX } = getIndicatorMetrics(
        availableWidth.value,
        routes.length,
        activeIndexValue.value,
      );
      return {
        width: cellWidth,
        transform: [{ translateX }],
      };
    },
    [routes.length],
  );

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
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
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
      <View
        style={[
          styles.host,
          { paddingBottom: insets.bottom },
        ]}
      >
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Navigation principale"
          onLayout={onBarLayout}
          style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.separator }]}
        >
          {routes.length > 0 && activeIndex !== null ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, { backgroundColor: withAlpha(theme.accent, "12") }, indicatorStyle]}
            />
          ) : null}
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
  host: {
    width: "100%",
    padding: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
    elevation: 0,
    shadowColor: "transparent",
    shadowOpacity: 0,
    position: "relative",
  },
  bar: { minHeight: 72, flexDirection: "row", alignItems: "center", marginHorizontal: spacing.sm, padding: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.xl, overflow: "visible", position: "relative" },
  indicator: { position: "absolute", top: spacing.sm, bottom: spacing.sm, left: spacing.xs, borderRadius: radius.lg, zIndex: 0 },
  item: { flex: 1, minWidth: 0, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2, borderRadius: radius.lg, zIndex: 1 },
  label: { maxWidth: "100%", fontSize: 10, fontWeight: "500", letterSpacing: -0.1, textAlign: "center" },
  labelFocused: { fontWeight: "700" },
  pressed: { opacity: 0.68 },
});
