import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { deleteSavingsRule, getFirstIncomeDate, listSavingsRules, setSavingsRule } from "@/db/savings";
import { listTransactions } from "@/db/transactions";
import type { SavingsRuleInput } from "@/types";

export async function loadSavingsSnapshot() {
  const db = await getDatabase();
  const [rules, incomeCategories, firstIncomeDate] = await Promise.all([
    listSavingsRules(db),
    listCategories(db, "income"),
    getFirstIncomeDate(db),
  ]);
  return { rules, incomeCategories, firstIncomeDate };
}

export async function loadSavingsHistory() {
  const db = await getDatabase();
  const [rules, transactions] = await Promise.all([listSavingsRules(db), listTransactions(db, { order: "asc" })]);
  return { rules, transactions };
}

export async function saveLocalSavingsRule(input: SavingsRuleInput): Promise<void> { await setSavingsRule(await getDatabase(), input); }
export async function deleteLocalSavingsRule(id: number): Promise<void> { await deleteSavingsRule(await getDatabase(), id); }
