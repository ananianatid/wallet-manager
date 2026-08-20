import { Tabs } from "expo-router";
import { WalletTabBar } from "@/components/wallet-tab-bar";
import { DESKTOP_BREAKPOINT, WebAppShell } from "@/components/web-app-shell";
import { useTheme } from "@/theme";
import { Platform, useWindowDimensions } from "react-native";
export const unstable_settings = {
  initialRouteName: "(dashboard)",
};

export default function TabsLayout() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  const navigator = (
    <Tabs
      initialRouteName="(dashboard)"
      tabBar={desktop ? () => null : (props) => <WalletTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: { backgroundColor: "transparent" },
        sceneStyle: { backgroundColor: theme.background },
        popToTopOnBlur: true,
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

  if (!desktop) {
    return navigator;
  }

  return <WebAppShell>{navigator}</WebAppShell>;
}
