import { Stack } from "expo-router/stack";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { ThemeProvider as AppThemeProvider, useTheme, useThemeControl } from "@/theme";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

function RootNavigator() {
  const theme = useTheme();
  const { scheme } = useThemeControl();
  return (
    <>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
        translucent={false}
      />
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.background },
            headerTitleStyle: { color: theme.label },
            headerShadowVisible: false,
            headerTintColor: theme.accent,
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="new-transaction"
            options={{ presentation: "modal", title: "Nouvelle transaction" }}
          />
          <Stack.Screen name="accounts/[id]" options={{ title: "Compte" }} />
          <Stack.Screen
            name="accounts/[id]/edit"
            options={{ title: "Modifier le compte" }}
          />
          <Stack.Screen name="goals/[id]" options={{ title: "Objectif" }} />
          <Stack.Screen
            name="goals/new"
            options={{ presentation: "modal", title: "Nouvel objectif" }}
          />
          <Stack.Screen name="cashflow" options={{ title: "Dépenses sûres" }} />
          <Stack.Screen name="categories/[type]" options={{ title: "Catégories" }} />
          <Stack.Screen name="appearance" options={{ title: "Apparence" }} />
          <Stack.Screen name="about" options={{ title: "À propos" }} />
        </Stack>
      </ThemeProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <RootNavigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
