import { deleteBudgetPlan, getBudgetSnapshot, listBudgetPlans, setBudgetPlan } from "@/db/budgets";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";

export async function loadBudgetsSnapshot(selectedMonth: string) {
  const db = await getDatabase();
  const [plans, expenseCategories, snapshots] = await Promise.all([
    listBudgetPlans(db),
    listCategories(db, "expense"),
    getBudgetSnapshot(db, selectedMonth),
  ]);
  return { plans, expenseCategories, snapshots };
}

export async function saveLocalBudgetPlan(
  categoryId: number | null,
  amount: number,
  currencyCode: string,
  rolloverEnabled: boolean,
): Promise<void> {
  await setBudgetPlan(await getDatabase(), categoryId, amount, currencyCode, rolloverEnabled);
}

export async function deleteLocalBudgetPlan(id: number): Promise<void> {
  await deleteBudgetPlan(await getDatabase(), id);
}
