import { createCategory, deleteCategory, listCategories, updateCategory } from "@/db/categories";
import { getDatabase } from "@/db/database";
import type { Category, CategoryInput, CategoryType, CategoryUpdateInput } from "@/types";

export function loadCategories(type: CategoryType) { return getDatabase().then((db) => listCategories(db, type)); }
export async function createLocalCategory(input: CategoryInput): Promise<Category> { return createCategory(await getDatabase(), input); }
export async function updateLocalCategory(id: number, input: CategoryUpdateInput): Promise<void> { await updateCategory(await getDatabase(), id, input); }
export async function deleteLocalCategory(id: number): Promise<void> { await deleteCategory(await getDatabase(), id); }
