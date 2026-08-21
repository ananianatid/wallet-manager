import { useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "expo-router/react-navigation";
import { ThemeProvider as AppThemeProvider, useTheme, useThemeControl } from "@/theme";
import { Platform, StatusBar } from "react-native";
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
import { CloudAuthProvider } from "@/cloud/auth-context";
import { SyncStatusProvider } from "@/cloud/sync-status";
export { default as ErrorBoundary } from "@/components/app-error-boundary";

const SPLASH_MIN_DURATION_MS = 800;
const splashStartedAt = Date.now();

void SplashScreen.preventAutoHideAsync().catch(() => {});
initObservability();

function RootNavigator({ initialRouteName }: { initialRouteName: "index" | "(tabs)" | "onboarding" | "cloud-welcome" }) {
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
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="app" options={{ headerShown: false }} />
          <Stack.Screen name="app/activity" options={{ headerShown: false }} />
          <Stack.Screen name="app/planning" options={{ headerShown: false }} />
          <Stack.Screen name="app/statistics" options={{ headerShown: false }} />
          <Stack.Screen name="app/accounts" options={{ headerShown: false }} />
          <Stack.Screen name="app/categories" options={{ headerShown: false }} />
          <Stack.Screen name="app/settings" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="cloud-welcome" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="cloud-account" options={{ title: "Compte et synchronisation" }} />
          <Stack.Screen name="reset-password" options={{ title: "Nouveau mot de passe" }} />
          <Stack.Screen name="recover-account" options={{ title: "Récupérer le compte" }} />
          <Stack.Screen name="sync-conflicts" options={{ title: "Conflits de synchronisation" }} />
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
          <Stack.Screen name="data-management" options={{ title: "Données" }} />
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
  const [isReady, setIsReady] = useState(Platform.OS === "web");
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsCloudWelcome, setNeedsCloudWelcome] = useState(false);
  const hasRoutedToDashboard = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let active = true;
    initLock();
    try {
      applyScreenSecurity();
    } catch {
      // L'écran reste protégé par le FLAG_SECURE natif si le réglage est illisible.
    }

    void (async () => {
      let shouldOnboard = false;
      let shouldShowCloudWelcome = false;
      try {
        const db = await getDatabase();
        try {
          await applyDueRecurring(db);
        } catch {
          // A recurring-operation failure must not block access to the local
          // application.
        }
        const accountCount = await db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) AS count FROM accounts WHERE deleted_at IS NULL",
        );
        const completed = await getSetting(db, "onboarding_completed");
        const started = await getSetting(db, "onboarding_started");
        const cloudWelcomeSeen = await getSetting(db, "cloud_welcome_seen");
        const hasAccounts = (accountCount?.count ?? 0) > 0;
        if (hasAccounts && completed !== "1" && started !== "1") {
          await setSetting(db, "onboarding_completed", "1");
        }
        shouldOnboard = completed !== "1" && (!hasAccounts || started === "1");
        // Progressif : cloud-welcome seulement après l'onboarding terminé, jamais avant.
        shouldShowCloudWelcome = cloudWelcomeSeen !== "1" && completed === "1" && !shouldOnboard;
      } catch {
        // The regular app shell remains available if the startup check fails.
      }
      if (!active) {
        return;
      }
      setNeedsOnboarding(shouldOnboard);
      setNeedsCloudWelcome(shouldShowCloudWelcome);
      setIsReady(true);
      void runStartupHealth();

      // Notification permissions and scheduling are secondary startup work.
      // They must not keep the native splash visible while Android waits for
      // a permission response.
      void getDatabase()
        .then((db) => schedulePendingRecurringNotifications(db))
        .catch(() => {
          // Notifications are optional and must never prevent app access.
        });
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const elapsed = Date.now() - splashStartedAt;
    const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - elapsed);
    const timeout = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, remaining);

    return () => clearTimeout(timeout);
  }, [isReady]);

  useEffect(() => {
    if (Platform.OS === "web" || !isReady || hasRoutedToDashboard.current) {
      return;
    }

    hasRoutedToDashboard.current = true;
    // Priorité onboarding, puis cloud-welcome progressif
    if (needsOnboarding) router.replace("/onboarding");
    else if (needsCloudWelcome) router.replace("/cloud-welcome");
    else router.replace("/(tabs)/(dashboard)");
  }, [isReady, needsCloudWelcome, needsOnboarding, router]);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <CloudAuthProvider>
        <SyncStatusProvider>
          <AppThemeProvider>
            <CurrencyProvider>
            {Platform.OS === "web" ? (
              <RootNavigator initialRouteName="index" />
            ) : needsOnboarding ? (
              <RootNavigator initialRouteName="onboarding" />
            ) : needsCloudWelcome ? (
              <RootNavigator initialRouteName="cloud-welcome" />
            ) : (
              <RootNavigator initialRouteName="(tabs)" />
            )}
            </CurrencyProvider>
          </AppThemeProvider>
        </SyncStatusProvider>
      </CloudAuthProvider>
    </SafeAreaProvider>
  );
}
