import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { getSetting, setSetting } from "@/db/settings";
import { uploadPendingCloudAttachments } from "./attachments";
import { pullSyncChanges, pushSyncChanges, type SyncChange, type SyncConflict } from "./api";

export type { SyncConflict } from "./api";

const CURSOR_KEY = "cloud_sync_cursor";
const DEVICE_ID_KEY = "cloud_sync_device_id";
const CONFLICTS_KEY = "cloud_sync_conflicts";
const OUTBOX_LIMIT = 100;

const SYNCABLE_TABLES = new Set([
  "categories",
  "account_groups",
  "accounts",
  "transactions",
  "transaction_splits",
  "people",
  "reimbursements",
  "reimbursement_settlements",
  "tags",
  "transaction_tags",
  "transaction_attachments",
  "budget_plans",
  "budget_periods",
  "recurring_transactions",
  "recurring_occurrences",
  "savings_rules",
  "goals",
  "goal_reservations",
]);

const RELATIONS: Record<string, Record<string, string>> = {
  accounts: { category_id: "categories", group_id: "account_groups" },
  transactions: { category_id: "categories", account_id: "accounts", destination_account_id: "accounts" },
  transaction_splits: { transaction_id: "transactions", category_id: "categories" },
  reimbursements: { transaction_id: "transactions", person_id: "people" },
  reimbursement_settlements: { reimbursement_id: "reimbursements", settlement_transaction_id: "transactions" },
  transaction_attachments: { transaction_id: "transactions" },
  budget_plans: { category_id: "categories" },
  budget_periods: { plan_id: "budget_plans" },
  recurring_transactions: { category_id: "categories", account_id: "accounts", destination_account_id: "accounts" },
  recurring_occurrences: { recurring_transaction_id: "recurring_transactions", transaction_id: "transactions" },
  savings_rules: { category_id: "categories" },
  goal_reservations: { goal_id: "goals", source_account_id: "accounts" },
  transaction_tags: { transaction_id: "transactions", tag_id: "tags" },
};

interface LocalSyncPayload {
  fields: Record<string, unknown>;
  refs: Record<string, string | null>;
}

export interface SyncRunResult {
  pushed: number;
  pulled: number;
  conflicts: SyncConflict[];
  cursor: number;
}

export type ConflictResolution = "server" | "local";

async function getDeviceId(db: SQLiteDatabase): Promise<string> {
  const current = await getSetting(db, DEVICE_ID_KEY as never);
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
  const id = randomUUID();
  await setSetting(db, DEVICE_ID_KEY as never, id);
  return id;
}

async function readOutbox(db: SQLiteDatabase, deviceId: string): Promise<SyncChange[]> {
  const rows = await db.getAllAsync<{
    id: number;
    entity_type: string;
    local_id: number;
    sync_id: string;
    sync_version: number;
    operation: "upsert" | "delete";
  }>(
    `SELECT o.id, o.entity_type, o.local_id, o.sync_id, o.sync_version, o.operation
     FROM sync_outbox o
     JOIN (
       SELECT entity_type, sync_id, MAX(id) AS id
       FROM sync_outbox
       GROUP BY entity_type, sync_id
     ) latest ON latest.id = o.id
     ORDER BY o.id
     LIMIT ?`,
    OUTBOX_LIMIT,
  );
  const changes: SyncChange[] = [];
  for (const row of rows) {
    if (!SYNCABLE_TABLES.has(row.entity_type) || !/^[0-9a-f-]{36}$/i.test(row.sync_id)) continue;
    let payload: Record<string, unknown> | null = null;
    if (row.operation === "upsert") {
      const table = row.entity_type;
      const item = await db.getFirstAsync<Record<string, unknown>>(
        table === "transaction_tags"
          ? `SELECT rowid AS id, transaction_id, tag_id, created_at, sync_id, sync_version FROM ${table} WHERE rowid = ?`
          : `SELECT * FROM ${table} WHERE id = ?`,
        row.local_id,
      );
      if (!item) continue;
      const relationMap = RELATIONS[row.entity_type] ?? {};
      const fields: Record<string, unknown> = {};
      const refs: Record<string, string | null> = {};
      for (const [key, value] of Object.entries(item)) {
        if (key === "id" || key === "sync_id" || key === "sync_version") continue;
        const relatedTable = relationMap[key];
        if (relatedTable) {
          const related = value == null
            ? null
            : await db.getFirstAsync<{ sync_id: string }>(`SELECT sync_id FROM ${relatedTable} WHERE id = ?`, Number(value));
          refs[key] = related?.sync_id ?? null;
        } else {
          fields[key] = value;
        }
      }
      payload = { fields, refs };
    }
    changes.push({
      clientChangeId: row.id,
      localId: row.local_id,
      entityType: row.entity_type,
      entityId: row.sync_id,
      version: row.sync_version + 1,
      baseVersion: row.sync_version,
      operation: row.operation,
      payload,
      deviceId,
    });
  }
  return changes;
}

function safeColumn(column: string): string {
  if (!/^[a-z_]+$/.test(column)) throw new Error("Colonne de synchronisation invalide.");
  return `"${column}"`;
}

function bindValue(value: unknown): string | number | null | Uint8Array {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return JSON.stringify(value);
}

async function applyRemoteChanges(db: SQLiteDatabase, changes: SyncChange[], blocked = new Set<string>()): Promise<void> {
  for (const change of changes) {
    if (!SYNCABLE_TABLES.has(change.entityType)) continue;
    if (blocked.has(`${change.entityType}:${change.entityId}`)) continue;
    const table = change.entityType;
    const existing = await db.getFirstAsync<{ id: number }>(
      table === "transaction_tags"
        ? `SELECT rowid AS id FROM ${table} WHERE sync_id = ?`
        : `SELECT id FROM ${table} WHERE sync_id = ?`,
      change.entityId,
    );
    if (change.operation === "delete") {
      if (existing) await db.runAsync(`DELETE FROM ${table} WHERE ${table === "transaction_tags" ? "rowid" : "id"} = ?`, existing.id);
      await db.runAsync("DELETE FROM sync_outbox WHERE sync_id = ?", change.entityId);
      continue;
    }
    const payload = change.payload as LocalSyncPayload | null;
    if (!payload || !payload.fields || !payload.refs) continue;
    const relationMap = RELATIONS[table] ?? {};
    const values: Record<string, unknown> = { ...payload.fields, sync_id: change.entityId, sync_version: change.version };
    for (const [column, relatedSyncId] of Object.entries(payload.refs)) {
      const relatedTable = relationMap[column];
      if (!relatedTable) continue;
      if (relatedSyncId == null) {
        values[column] = null;
      } else {
        const related = await db.getFirstAsync<{ id: number }>(`SELECT id FROM ${relatedTable} WHERE sync_id = ?`, relatedSyncId);
        if (!related) throw new Error(`Référence de synchronisation introuvable: ${relatedTable}.${relatedSyncId}`);
        values[column] = related.id;
      }
    }
    const columns = Object.keys(values).map(safeColumn);
    const params = Object.values(values).map(bindValue);
    if (existing) {
      const assignments = columns.map((column) => `${column} = ?`).join(", ");
      await db.runAsync(`UPDATE ${table} SET ${assignments} WHERE ${table === "transaction_tags" ? "rowid" : "id"} = ?`, ...params, existing.id);
    } else {
      await db.runAsync(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, ...params);
    }
    await db.runAsync("DELETE FROM sync_outbox WHERE sync_id = ?", change.entityId);
  }
}

async function readStoredConflicts(db: SQLiteDatabase): Promise<SyncConflict[]> {
  const raw = await getSetting(db, CONFLICTS_KEY as never);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as SyncConflict[] : [];
  } catch {
    return [];
  }
}

async function writeStoredConflicts(db: SQLiteDatabase, conflicts: SyncConflict[]): Promise<void> {
  await setSetting(db, CONFLICTS_KEY as never, JSON.stringify(conflicts));
}

export async function listSyncConflicts(db: SQLiteDatabase): Promise<SyncConflict[]> {
  return readStoredConflicts(db);
}

export async function resolveSyncConflict(db: SQLiteDatabase, conflict: SyncConflict, resolution: ConflictResolution): Promise<void> {
  if (resolution === "server") {
    await applyRemoteChanges(db, [{
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      version: conflict.serverVersion,
      operation: conflict.serverOperation ?? "upsert",
      payload: conflict.serverPayload as Record<string, unknown> | null,
    }]);
  } else {
    if (conflict.localId == null) throw new Error("Élément local du conflit introuvable.");
    const key = conflict.entityType === "transaction_tags" ? "rowid" : "id";
    await db.runAsync("DELETE FROM sync_outbox WHERE sync_id = ?", conflict.entityId);
    await db.runAsync(`UPDATE ${conflict.entityType} SET sync_version = ? WHERE ${key} = ?`, conflict.serverVersion, conflict.localId);
  }
  const remaining = (await readStoredConflicts(db)).filter((item) => !(item.entityType === conflict.entityType && item.entityId === conflict.entityId));
  await writeStoredConflicts(db, remaining);
}

export async function runSync(db: SQLiteDatabase): Promise<SyncRunResult> {
  await uploadPendingCloudAttachments(db);
  const deviceId = await getDeviceId(db);
  const existingConflicts = await readStoredConflicts(db);
  const blocked = new Set(existingConflicts.map((item) => `${item.entityType}:${item.entityId}`));
  const pending = (await readOutbox(db, deviceId)).filter((item) => !blocked.has(`${item.entityType}:${item.entityId}`));
  const pushed = pending.length > 0 ? await pushSyncChanges(pending) : { accepted: [], conflicts: [] };
  const newConflicts = pushed.conflicts.map((conflict) => ({
    ...conflict,
    localId: pending.find((item) => item.entityType === conflict.entityType && item.entityId === conflict.entityId)?.localId,
  }));
  const allConflicts = [...existingConflicts.filter((old) => !newConflicts.some((next) => next.entityType === old.entityType && next.entityId === old.entityId)), ...newConflicts];
  if (newConflicts.length > 0) await writeStoredConflicts(db, allConflicts);
  const conflictKeys = new Set(allConflicts.map((item) => `${item.entityType}:${item.entityId}`));
  for (const clientChangeId of pushed.accepted) {
    const change = pending.find((item) => item.clientChangeId === clientChangeId);
    if (!change || change.clientChangeId == null) continue;
    const outboxId = change.clientChangeId;
    if (change.operation === "upsert") {
      const key = change.entityType === "transaction_tags" ? "rowid" : "id";
      await db.runAsync(`UPDATE ${change.entityType} SET sync_version = ? WHERE ${key} = ?`, change.version, await localIdForChange(db, outboxId));
    }
    await db.runAsync("DELETE FROM sync_outbox WHERE sync_id = ?", change.entityId);
  }
  const cursor = Number((await getSetting(db, CURSOR_KEY as never)) ?? "0");
  const pulled = await pullSyncChanges(cursor);
  await applyRemoteChanges(db, pulled.changes, conflictKeys);
  const nextCursor = pulled.nextCursor;
  if (nextCursor !== cursor) await setSetting(db, CURSOR_KEY as never, String(nextCursor));
  return { pushed: pushed.accepted.length, pulled: pulled.changes.length, conflicts: allConflicts, cursor: nextCursor };
}

async function localIdForChange(db: SQLiteDatabase, outboxId: number): Promise<number> {
  const row = await db.getFirstAsync<{ id: number }>("SELECT local_id AS id FROM sync_outbox WHERE id = ?", outboxId);
  if (!row) throw new Error("Élément de synchronisation introuvable.");
  return row.id;
}
