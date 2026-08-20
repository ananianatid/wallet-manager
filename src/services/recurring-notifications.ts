import Constants from "expo-constants";
import type { SQLiteDatabase } from "expo-sqlite";
import {
  listPendingRecurringOccurrences,
  setRecurringOccurrenceNotificationId,
} from "@/db/recurring";
import { formatAmount } from "@/utils/format";

let handlerConfigured = false;
let notificationsModule: NotificationsModule | null = null;
let notificationsLoadAttempted = false;

type NotificationsModule = typeof import("expo-notifications");

async function loadNotifications(): Promise<NotificationsModule | null> {
  // Expo Go on Android does not include expo-notifications anymore. Keep the
  // finance app usable there; standalone APKs and development builds still
  // load the native module normally.
  if (Constants.expoGoConfig || notificationsLoadAttempted) {
    return notificationsModule;
  }
  notificationsLoadAttempted = true;
  try {
    notificationsModule = await import("expo-notifications");
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}

export function configureRecurringNotifications(Notifications: NotificationsModule): void {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

export async function schedulePendingRecurringNotifications(
  db: SQLiteDatabase,
): Promise<{ scheduled: number; permissionGranted: boolean }> {
  const now = Date.now();
  const pending = await listPendingRecurringOccurrences(db);
  const toSchedule = pending.filter(
    (occurrence) => occurrence.notificationId == null && occurrence.occurrenceDate >= now,
  );
  if (toSchedule.length === 0) {
    return { scheduled: 0, permissionGranted: true };
  }
  const Notifications = await loadNotifications();
  if (!Notifications) {
    return { scheduled: 0, permissionGranted: false };
  }
  configureRecurringNotifications(Notifications);
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== Notifications.PermissionStatus.GRANTED) {
    return { scheduled: 0, permissionGranted: false };
  }

  let scheduled = 0;
  for (const occurrence of toSchedule) {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Échéance récurrente à valider",
        body: `${formatAmount(occurrence.snapshot.amount, occurrence.snapshot.sourceCurrencyCode)} à enregistrer dans Wallet.`,
        data: { occurrenceId: occurrence.id, route: "/recurring" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(occurrence.occurrenceDate),
      },
    });
    await setRecurringOccurrenceNotificationId(db, occurrence.id, notificationId);
    scheduled += 1;
  }
  return { scheduled, permissionGranted: true };
}
