import type { SQLiteDatabase } from "expo-sqlite";
import {
  DEFAULT_CATEGORY_ICON,
  isCategoryIconName,
  normalizeCategoryIcon,
} from "@/constants/category-icons";
import type {
  Category,
  CategoryInput,
  CategoryType,
  CategoryUpdateInput,
} from "../types";

interface CategoryRow {
  id: number;
  type: CategoryType;
  name: string;
  isSeed: number;
  icon: string | null;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    isSeed: row.isSeed === 1,
    icon: row.type === "account" ? null : normalizeCategoryIcon(row.icon),
  };
}

const SELECT_FIELDS = "id, type, name, is_seed AS isSeed, icon";

export function listCategories(
  db: SQLiteDatabase,
  type?: CategoryType,
): Promise<Category[]> {
  return type
    ? db
        .getAllAsync<CategoryRow>(
          `SELECT ${SELECT_FIELDS} FROM categories WHERE type = ? ORDER BY name`,
          type,
        )
        .then((rows) => rows.map(mapCategory))
    : db
        .getAllAsync<CategoryRow>(
          `SELECT ${SELECT_FIELDS} FROM categories ORDER BY type, name`,
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
  const icon = input.type === "account" ? null : input.icon ?? DEFAULT_CATEGORY_ICON;
  if (input.type !== "account" && !isCategoryIconName(icon)) {
    throw new Error("L'icône de la catégorie est invalide.");
  }
  let result;
  try {
    result = await db.runAsync(
      "INSERT INTO categories (type, name, is_seed, icon) VALUES (?, ?, 0, ?)",
      input.type,
      name,
      icon,
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("Une catégorie de ce type porte déjà ce nom.");
    }
    throw e;
  }
  const row = await db.getFirstAsync<CategoryRow>(
    `SELECT ${SELECT_FIELDS} FROM categories WHERE id = ?`,
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
  await updateCategory(db, id, { name });
}

export async function updateCategory(
  db: SQLiteDatabase,
  id: number,
  input: CategoryUpdateInput,
): Promise<void> {
  const trimmed = input.name.trim();
  if (!trimmed) {
    throw new Error("Le nom de la catégorie ne peut pas être vide.");
  }
  const current = await db.getFirstAsync<{ type: CategoryType; icon: string | null }>(
    "SELECT type, icon FROM categories WHERE id = ?",
    id,
  );
  if (!current) {
    throw new Error("Catégorie introuvable.");
  }
  let icon = current.type === "account" ? null : normalizeCategoryIcon(current.icon);
  if (current.type !== "account" && input.icon !== undefined) {
    if (input.icon == null || !isCategoryIconName(input.icon)) {
      throw new Error("L'icône de la catégorie est obligatoire.");
    }
    icon = input.icon;
  }
  try {
    await db.runAsync(
      "UPDATE categories SET name = ?, icon = ? WHERE id = ?",
      trimmed,
      icon,
      id,
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("Une catégorie de ce type porte déjà ce nom.");
    }
    throw e;
  }
}

export async function ensureCategory(
  db: SQLiteDatabase,
  type: CategoryType,
  name: string,
): Promise<number> {
  const trimmed = name.trim() || "Autre";
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM categories WHERE type = ? AND name = ?",
    type,
    trimmed,
  );
  if (existing) {
    return existing.id;
  }
  const icon = type === "account" ? null : DEFAULT_CATEGORY_ICON;
  const result = await db.runAsync(
    "INSERT INTO categories (type, name, is_seed, icon) VALUES (?, ?, 0, ?)",
    type,
    trimmed,
    icon,
  );
  return Number(result.lastInsertRowId);
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
