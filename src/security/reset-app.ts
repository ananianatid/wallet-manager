import { DATABASE_NAME, closeDatabase } from "@/db/database";
import * as SQLite from "expo-sqlite";
import { clearPinCredentials, setLockEnabled } from "@/security/store";
import { refreshLockConfig } from "@/state/lock";
import { bumpDataEpoch } from "@/state/data-epoch";

export async function resetAppData(): Promise<void> {
  await closeDatabase();
  await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  await clearPinCredentials();
  await setLockEnabled(false);
  await refreshLockConfig();
  bumpDataEpoch();
}
