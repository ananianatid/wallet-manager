import type { SQLiteDatabase } from "expo-sqlite";
import type { AccountGroup } from "../types";

interface AccountGroupRow {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: number;
  deletedAt: number | null;
  accountCount: number;
}

function mapAccountGroup(row: AccountGroupRow): AccountGroup {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    accountCount: row.accountCount,
  };
}

const SELECT_FIELDS = `
  g.id, g.name, g.sort_order AS sortOrder, g.created_at AS createdAt,
  g.deleted_at AS deletedAt,
  (SELECT COUNT(*) FROM accounts a WHERE a.group_id = g.id) AS accountCount
`;

export async function listAccountGroups(
  db: SQLiteDatabase,
): Promise<AccountGroup[]> {
  const rows = await db.getAllAsync<AccountGroupRow>(
    `SELECT ${SELECT_FIELDS} FROM account_groups g
     WHERE g.deleted_at IS NULL
     ORDER BY g.sort_order ASC, g.name ASC`,
  );
  return rows.map(mapAccountGroup);
}

export async function listDeletedAccountGroups(
  db: SQLiteDatabase,
): Promise<AccountGroup[]> {
  const rows = await db.getAllAsync<AccountGroupRow>(
    `SELECT ${SELECT_FIELDS} FROM account_groups g
     WHERE g.deleted_at IS NOT NULL
     ORDER BY g.deleted_at DESC`,
  );
  return rows.map(mapAccountGroup);
}

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Error &&
    typeof e.message === "string" &&
    e.message.includes("UNIQUE")
  );
}

export async function createAccountGroup(
  db: SQLiteDatabase,
  name: string,
): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Le nom du groupe ne peut pas être vide.");
  }
  try {
    const result = await db.runAsync(
      `INSERT INTO account_groups (name, sort_order, created_at)
       VALUES (?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM account_groups WHERE deleted_at IS NULL), ?)`,
      trimmed,
      Date.now(),
    );
    return Number(result.lastInsertRowId);
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("Un groupe de comptes porte déjà ce nom.");
    }
    throw e;
  }
}

export async function renameAccountGroup(
  db: SQLiteDatabase,
  id: number,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Le nom du groupe ne peut pas être vide.");
  }
  try {
    await db.runAsync(
      "UPDATE account_groups SET name = ? WHERE id = ? AND deleted_at IS NULL",
      trimmed,
      id,
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("Un groupe de comptes porte déjà ce nom.");
    }
    throw e;
  }
}

export async function softDeleteAccountGroup(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE accounts SET group_id = NULL WHERE group_id = ?", id);
    await db.runAsync(
      "UPDATE account_groups SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
      Date.now(),
      id,
    );
  });
}

export async function restoreAccountGroup(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  try {
    await db.runAsync(
      "UPDATE account_groups SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL",
      id,
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("Un groupe actif porte déjà ce nom.");
    }
    throw e;
  }
}

export async function assignAccountGroup(
  db: SQLiteDatabase,
  accountId: number,
  groupId: number | null,
): Promise<void> {
  if (groupId != null) {
    const existing = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM account_groups WHERE id = ? AND deleted_at IS NULL",
      groupId,
    );
    if (!existing) {
      throw new Error("Groupe de comptes introuvable.");
    }
  }
  await db.runAsync("UPDATE accounts SET group_id = ? WHERE id = ?", groupId, accountId);
}

export async function reorderAccountGroups(
  db: SQLiteDatabase,
  orderedIds: number[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync(
        "UPDATE account_groups SET sort_order = ? WHERE id = ? AND deleted_at IS NULL",
        i,
        orderedIds[i],
      );
    }
  });
}
