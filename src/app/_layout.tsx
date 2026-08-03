import { Stack } from "expo-router/stack";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { ThemeProvider as AppThemeProvider, useTheme, useThemeControl } from "@/theme";

function RootNavigator() {
  const theme = useTheme();
  const { scheme } = useThemeControl();
  return (
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
        <Stack.Screen name="categories/[type]" options={{ title: "Catégories" }} />
        <Stack.Screen name="appearance" options={{ title: "Apparence" }} />
        <Stack.Screen name="about" options={{ title: "À propos" }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}
