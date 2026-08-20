import { useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { ThemeProvider as AppThemeProvider, useTheme, useThemeControl } from "@/theme";
import { StatusBar } from "react-native";
import { useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CompactStackHeader } from "@/components/compact-stack-header";
import { LockScreen } from "@/components/lock-screen";
import { initLock, useLockState } from "@/state/lock";
import { applyScreenSecurity } from "@/security/screen-capture";
import { useDataEpoch } from "@/state/data-epoch";
import { CurrencyProvider } from "@/currency/context";
import { getDatabase } from "@/db/database";
import { getSetting, setSetting } from "@/db/settings";
import { initObservability } from "@/services/observability";
import { runStartupHealth } from "@/utils/diagnostics";
import { applyDueRecurring } from "@/db/recurring";
import { schedulePendingRecurringNotifications } from "@/services/recurring-notifications";
export { default as ErrorBoundary } from "@/components/app-error-boundary";

void SplashScreen.preventAutoHideAsync().catch(() => {});
initObservability();

function RootNavigator({ initialRouteName }: { initialRouteName: "(tabs)" | "onboarding" }) {
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
          initialRouteName={initialRouteName}
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
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen
            name="new-transaction"
            options={{ presentation: "modal", title: "Nouvelle transaction" }}
          />
          <Stack.Screen name="transaction-detail" options={{ title: "Détail de la transaction" }} />
          <Stack.Screen
            name="reimbursement-settlement"
            options={{ presentation: "modal", title: "Enregistrer le règlement" }}
          />
          <Stack.Screen
            name="import-csv"
            options={{ presentation: "modal", title: "Importer un CSV" }}
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
          <Stack.Screen name="privacy-policy" options={{ title: "Confidentialité" }} />
          <Stack.Screen name="diagnostics" options={{ title: "Diagnostics" }} />
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
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const hasRoutedToDashboard = useRef(false);

  useEffect(() => {
    let active = true;
    initLock();
    try {
      applyScreenSecurity();
    } catch {
      // L'écran reste protégé par le FLAG_SECURE natif si le réglage est illisible.
    }

    void (async () => {
      let shouldOnboard = false;
      try {
        const db = await getDatabase();
        try {
          await applyDueRecurring(db);
          await schedulePendingRecurringNotifications(db);
        } catch {
          // A refused notification permission or an unavailable exchange rate
          // must not block access to the local application.
        }
        const accountCount = await db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) AS count FROM accounts WHERE deleted_at IS NULL",
        );
        const completed = await getSetting(db, "onboarding_completed");
        const started = await getSetting(db, "onboarding_started");
        const hasAccounts = (accountCount?.count ?? 0) > 0;
        if (hasAccounts && completed !== "1" && started !== "1") {
          await setSetting(db, "onboarding_completed", "1");
        }
        shouldOnboard = completed !== "1" && (!hasAccounts || started === "1");
      } catch {
        // The regular app shell remains available if the startup check fails.
      }
      if (!active) {
        return;
      }
      setNeedsOnboarding(shouldOnboard);
      setIsReady(true);
      void runStartupHealth();
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady || needsOnboarding || hasRoutedToDashboard.current) {
      return;
    }

    hasRoutedToDashboard.current = true;
    router.replace("/(tabs)/(dashboard)");
  }, [isReady, needsOnboarding, router]);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <CurrencyProvider>
          <RootNavigator initialRouteName={needsOnboarding ? "onboarding" : "(tabs)"} />
        </CurrencyProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
