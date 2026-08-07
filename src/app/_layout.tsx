import { Stack } from "expo-router/stack";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { ThemeProvider as AppThemeProvider, useTheme, useThemeControl } from "@/theme";
import { StatusBar } from "react-native";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CompactStackHeader } from "@/components/compact-stack-header";
import { LockScreen } from "@/components/lock-screen";
import { initLock, useLockState } from "@/state/lock";
import { useDataEpoch } from "@/state/data-epoch";
import { CurrencyProvider } from "@/currency/context";

function RootNavigator() {
  const theme = useTheme();
  const { scheme } = useThemeControl();
  const lock = useLockState();
  const epoch = useDataEpoch();
  return (
    <>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
        translucent={false}
      />
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack
          key={epoch}
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.background,
            },
            header: CompactStackHeader,
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
          <Stack.Screen name="calendar-settings" options={{ title: "Calendrier" }} />
          <Stack.Screen name="about" options={{ title: "À propos" }} />
          <Stack.Screen name="security" options={{ title: "Sécurité" }} />
          <Stack.Screen
            name="pin-setup"
            options={{ presentation: "modal", title: "Code" }}
          />
          <Stack.Screen
            name="backup-export"
            options={{ presentation: "modal", title: "Exporter une sauvegarde" }}
          />
          <Stack.Screen
            name="backup-restore"
            options={{ presentation: "modal", title: "Restaurer une sauvegarde" }}
          />
        </Stack>
      </ThemeProvider>
      {lock.status !== "unlocked" ? (
        <LockScreen obscured={lock.status === "obscured"} />
      ) : null}
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initLock();
  }, []);

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <CurrencyProvider>
          <RootNavigator />
        </CurrencyProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
