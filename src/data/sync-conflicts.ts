import { getDatabase } from "@/db/database";
import { listSyncConflicts, resolveSyncConflict, type SyncConflict } from "@/cloud/sync";

export function loadLocalSyncConflicts(): Promise<SyncConflict[]> {
  return getDatabase().then(listSyncConflicts);
}

export function resolveLocalSyncConflict(conflict: SyncConflict, choice: "server" | "local"): Promise<void> {
  return getDatabase().then((db) => resolveSyncConflict(db, conflict, choice));
}
