import type { SQLiteDatabase } from "expo-sqlite";
import { normalizeCategoryIcon } from "@/constants/category-icons";
import type { SavingsRule, SavingsRuleInput } from "../types";

interface SavingsRuleRow {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  percent: number;
  createdAt: number;
  startDate: number | null;
}

function mapSavingsRule(row: SavingsRuleRow): SavingsRule {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryIcon: row.categoryName ? normalizeCategoryIcon(row.categoryIcon) : null,
    percent: row.percent,
    createdAt: row.createdAt,
    startDate: row.startDate,
  };
}

export async function listSavingsRules(
  db: SQLiteDatabase,
): Promise<SavingsRule[]> {
  const rows = await db.getAllAsync<SavingsRuleRow>(
    `SELECT s.id,
            s.category_id AS categoryId,
            c.name AS categoryName,
            c.icon AS categoryIcon,
            s.percent,
            s.created_at AS createdAt,
            s.start_date AS startDate
     FROM savings_rules s
     LEFT JOIN categories c ON c.id = s.category_id
     ORDER BY c.name IS NULL DESC, c.name`,
  );
  return rows.map(mapSavingsRule);
}

export async function getFirstIncomeDate(
  db: SQLiteDatabase,
): Promise<number | null> {
  const row = await db.getFirstAsync<{ firstDate: number | null }>(
    `SELECT MIN(t.transaction_date) AS firstDate
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id AND a.deleted_at IS NULL
     WHERE t.type = 'income'`,
  );
  return row?.firstDate ?? null;
}

export async function setSavingsRule(
  db: SQLiteDatabase,
  input: SavingsRuleInput,
): Promise<void> {
  const { categoryId, percent, startDate } = input;
  if (!Number.isInteger(percent) || percent <= 0 || percent > 100) {
    throw new Error("Le pourcentage doit être un entier entre 1 et 100.");
  }
  if (categoryId == null) {
    const existing = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM savings_rules WHERE category_id IS NULL",
    );
    if (existing) {
      await db.runAsync(
        "UPDATE savings_rules SET percent = ?, start_date = ? WHERE id = ?",
        percent,
        startDate,
        existing.id,
      );
      return;
    }
    await db.runAsync(
      "INSERT INTO savings_rules (category_id, percent, created_at, start_date) VALUES (NULL, ?, ?, ?)",
      percent,
      Date.now(),
      startDate,
    );
    return;
  }
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM savings_rules WHERE category_id = ?",
    categoryId,
  );
  if (existing) {
    await db.runAsync(
      "UPDATE savings_rules SET percent = ?, start_date = ? WHERE id = ?",
      percent,
      startDate,
      existing.id,
    );
    return;
  }
  await db.runAsync(
    "INSERT INTO savings_rules (category_id, percent, created_at, start_date) VALUES (?, ?, ?, ?)",
    categoryId,
    percent,
    Date.now(),
    startDate,
  );
}

export async function deleteSavingsRule(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync("DELETE FROM savings_rules WHERE id = ?", id);
}
