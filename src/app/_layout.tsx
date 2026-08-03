import { Stack } from "expo-router/stack";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { useColorScheme } from "react-native";
import { useTheme } from "@/theme";

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
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
        </Stack>
      </ThemeProvider>
  );
}
