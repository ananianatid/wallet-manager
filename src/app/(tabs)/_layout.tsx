import { Tabs } from "expo-router";
import { WalletTabBar } from "@/components/wallet-tab-bar";
import { getTabAnimation, motion, useReduceMotion } from "@/components/motion";
import { useTheme } from "@/theme";
import { Easing, Platform } from "react-native";
export const unstable_settings = {
  initialRouteName: "(dashboard)",
};

export default function TabsLayout() {
  const theme = useTheme();
  const reducedMotion = useReduceMotion();
  const tabAnimation = getTabAnimation(Platform.OS, reducedMotion);
  const navigator = (
    <Tabs
      initialRouteName="(dashboard)"
      tabBar={(props) => <WalletTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: "transparent",
          shadowOpacity: 0,
        },
        sceneStyle: { backgroundColor: theme.background },
        popToTopOnBlur: true,
        animation: tabAnimation,
        transitionSpec: {
          animation: "timing",
          config: {
            duration: tabAnimation === "none" ? 0 : motion.standard,
            easing: Easing.out(Easing.cubic),
          },
        },
      }}
    >
      <Tabs.Screen name="(dashboard)" options={{ title: "Accueil", tabBarAccessibilityLabel: "Accueil" }} />
      <Tabs.Screen name="(transactions)" options={{ title: "Activité", tabBarAccessibilityLabel: "Activité" }} />
      <Tabs.Screen name="(plans)" options={{ title: "Planification", tabBarAccessibilityLabel: "Planification" }} />
      <Tabs.Screen name="(accounts)" options={{ title: "Comptes", tabBarAccessibilityLabel: "Comptes" }} />
      <Tabs.Screen name="(settings)" options={{ title: "Réglages", href: null }} />
      <Tabs.Screen name="(statistics)" options={{ title: "Statistiques", tabBarAccessibilityLabel: "Statistiques" }} />
    </Tabs>
  );

  return navigator;
}
