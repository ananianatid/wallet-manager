import type { SQLiteDatabase } from "expo-sqlite";
import type { Category, CategoryInput, CategoryType } from "../types";

interface CategoryRow {
  id: number;
  type: CategoryType;
  name: string;
  isSeed: number;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    isSeed: row.isSeed === 1,
  };
}

export function listCategories(
  db: SQLiteDatabase,
  type?: CategoryType,
): Promise<Category[]> {
  return type
    ? db
        .getAllAsync<CategoryRow>(
          "SELECT id, type, name, is_seed AS isSeed FROM categories WHERE type = ? ORDER BY name",
          type,
        )
        .then((rows) => rows.map(mapCategory))
    : db
        .getAllAsync<CategoryRow>(
          "SELECT id, type, name, is_seed AS isSeed FROM categories ORDER BY type, name",
        )
        .then((rows) => rows.map(mapCategory));
}

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Error &&
    typeof e.message === "string" &&
    e.message.includes("UNIQUE")
  );
}

export async function createCategory(
  db: SQLiteDatabase,
  input: CategoryInput,
): Promise<Category> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom de la catégorie ne peut pas être vide.");
  }
  let result;
  try {
    result = await db.runAsync(
      "INSERT INTO categories (type, name, is_seed) VALUES (?, ?, 0)",
      input.type,
      name,
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("Une catégorie de ce type porte déjà ce nom.");
    }
    throw e;
  }
  const row = await db.getFirstAsync<CategoryRow>(
    "SELECT id, type, name, is_seed AS isSeed FROM categories WHERE id = ?",
    result.lastInsertRowId,
  );
  if (!row) {
    throw new Error("Catégorie introuvable après création.");
  }
  return mapCategory(row);
}

export async function renameCategory(
  db: SQLiteDatabase,
  id: number,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Le nom de la catégorie ne peut pas être vide.");
  }
  try {
    await db.runAsync("UPDATE categories SET name = ? WHERE id = ?", trimmed, id);
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("Une catégorie de ce type porte déjà ce nom.");
    }
    throw e;
  }
}

export async function deleteCategory(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  const usedByAccount = await db.getFirstAsync<{ used: number }>(
    "SELECT EXISTS(SELECT 1 FROM accounts WHERE category_id = ?) AS used",
    id,
  );
  if (usedByAccount?.used) {
    throw new Error(
      "Cette catégorie est utilisée par un compte. Supprimez d'abord le compte.",
    );
  }
  const usedByTransaction = await db.getFirstAsync<{ used: number }>(
    "SELECT EXISTS(SELECT 1 FROM transactions WHERE category_id = ?) AS used",
    id,
  );
  if (usedByTransaction?.used) {
    throw new Error(
      "Cette catégorie est utilisée par une transaction. Supprimez d'abord la transaction.",
    );
  }
  await db.runAsync("DELETE FROM categories WHERE id = ?", id);
}
