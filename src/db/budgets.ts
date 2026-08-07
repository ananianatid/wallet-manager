import type { SQLiteDatabase } from "expo-sqlite";
import { normalizeCategoryIcon } from "@/constants/category-icons";
import type { Budget } from "../types";

interface BudgetRow {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  amount: number;
  currencyCode: string;
  createdAt: number;
}

function mapBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryIcon: row.categoryName ? normalizeCategoryIcon(row.categoryIcon) : null,
    amount: row.amount,
    currencyCode: row.currencyCode,
    createdAt: row.createdAt,
  };
}

export async function listBudgets(db: SQLiteDatabase): Promise<Budget[]> {
  const rows = await db.getAllAsync<BudgetRow>(
    `SELECT b.id,
            b.category_id AS categoryId,
            c.name AS categoryName,
            c.icon AS categoryIcon,
            b.amount,
            b.currency_code AS currencyCode,
            b.created_at AS createdAt
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     ORDER BY c.name IS NULL DESC, c.name`,
  );
  return rows.map(mapBudget);
}

export async function setBudget(
  db: SQLiteDatabase,
  categoryId: number | null,
  amount: number,
  currencyCode = "XOF",
): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Le montant du budget doit être un entier positif.");
  }
  if (categoryId == null) {
    const existing = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM budgets WHERE category_id IS NULL",
    );
    if (existing) {
      await db.runAsync(
        "UPDATE budgets SET amount = ?, currency_code = ? WHERE id = ?",
        amount,
        currencyCode,
        existing.id,
      );
      return;
    }
    await db.runAsync(
      "INSERT INTO budgets (category_id, amount, currency_code, created_at) VALUES (NULL, ?, ?, ?)",
      amount,
      currencyCode,
      Date.now(),
    );
    return;
  }
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM budgets WHERE category_id = ?",
    categoryId,
  );
  if (existing) {
    await db.runAsync(
      "UPDATE budgets SET amount = ?, currency_code = ? WHERE id = ?",
      amount,
      currencyCode,
      existing.id,
    );
    return;
  }
  await db.runAsync(
    "INSERT INTO budgets (category_id, amount, currency_code, created_at) VALUES (?, ?, ?, ?)",
    categoryId,
    amount,
    currencyCode,
    Date.now(),
  );
}

export async function deleteBudget(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync("DELETE FROM budgets WHERE id = ?", id);
}
