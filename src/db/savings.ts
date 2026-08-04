import type { SQLiteDatabase } from "expo-sqlite";
import type { SavingsRule, SavingsRuleInput } from "../types";

interface SavingsRuleRow {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  percent: number;
  createdAt: number;
}

function mapSavingsRule(row: SavingsRuleRow): SavingsRule {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    percent: row.percent,
    createdAt: row.createdAt,
  };
}

export async function listSavingsRules(
  db: SQLiteDatabase,
): Promise<SavingsRule[]> {
  const rows = await db.getAllAsync<SavingsRuleRow>(
    `SELECT s.id,
            s.category_id AS categoryId,
            c.name AS categoryName,
            s.percent,
            s.created_at AS createdAt
     FROM savings_rules s
     LEFT JOIN categories c ON c.id = s.category_id
     ORDER BY c.name IS NULL DESC, c.name`,
  );
  return rows.map(mapSavingsRule);
}

export async function setSavingsRule(
  db: SQLiteDatabase,
  input: SavingsRuleInput,
): Promise<void> {
  const { categoryId, percent } = input;
  if (!Number.isInteger(percent) || percent <= 0 || percent > 100) {
    throw new Error("Le pourcentage doit être un entier entre 1 et 100.");
  }
  if (categoryId == null) {
    const existing = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM savings_rules WHERE category_id IS NULL",
    );
    if (existing) {
      await db.runAsync(
        "UPDATE savings_rules SET percent = ? WHERE id = ?",
        percent,
        existing.id,
      );
      return;
    }
    await db.runAsync(
      "INSERT INTO savings_rules (category_id, percent, created_at) VALUES (NULL, ?, ?)",
      percent,
      Date.now(),
    );
    return;
  }
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM savings_rules WHERE category_id = ?",
    categoryId,
  );
  if (existing) {
    await db.runAsync(
      "UPDATE savings_rules SET percent = ? WHERE id = ?",
      percent,
      existing.id,
    );
    return;
  }
  await db.runAsync(
    "INSERT INTO savings_rules (category_id, percent, created_at) VALUES (?, ?, ?)",
    categoryId,
    percent,
    Date.now(),
  );
}

export async function deleteSavingsRule(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync("DELETE FROM savings_rules WHERE id = ?", id);
}
