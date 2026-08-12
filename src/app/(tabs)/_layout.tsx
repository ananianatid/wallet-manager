import { Tabs } from "expo-router";
import { WalletTabBar } from "@/components/wallet-tab-bar";
import { useTheme } from "@/theme";

export const unstable_settings = {
  initialRouteName: "(dashboard)",
};

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      initialRouteName="(dashboard)"
      tabBar={(props) => <WalletTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: { backgroundColor: "transparent" },
        sceneStyle: { backgroundColor: theme.background },
        popToTopOnBlur: true,
      }}
    >
      <Tabs.Screen name="(dashboard)" options={{ title: "Accueil", tabBarAccessibilityLabel: "Accueil" }} />
      <Tabs.Screen name="(transactions)" options={{ title: "Transactions", tabBarAccessibilityLabel: "Transactions" }} />
      <Tabs.Screen name="(statistics)" options={{ title: "Statistiques", tabBarAccessibilityLabel: "Statistiques" }} />
      <Tabs.Screen name="(accounts)" options={{ title: "Comptes", tabBarAccessibilityLabel: "Comptes" }} />
      <Tabs.Screen name="(settings)" options={{ title: "Paramètres", tabBarAccessibilityLabel: "Paramètres" }} />
    </Tabs>
  );
}
