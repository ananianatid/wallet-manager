import type { Budget, Goal } from "@/types";
import type { CategorySlice } from "@/utils/statistics";

export interface BudgetProgressRow {
  budget: Budget;
  spent: number;
  pct: number;
  over: boolean;
}

/**
 * Calcule la progression de chaque budget pour le mois courant.
 * Un budget sans catégorie (categoryId null) couvre toutes les dépenses.
 */
export function budgetProgress(
  budgets: Budget[],
  spentByCategory: ReadonlyMap<number, number>,
  totalExpense: number,
): BudgetProgressRow[] {
  return budgets.map((budget) => {
    const spent =
      budget.categoryId == null
        ? totalExpense
        : (spentByCategory.get(budget.categoryId) ?? 0);
    const pct = budget.amount <= 0 ? 0 : Math.min((spent / budget.amount) * 100, 100);
    return { budget, spent, pct, over: spent > budget.amount };
  });
}

/**
 * Sélectionne les objectifs les plus urgents : non atteints, triés par
 * échéance croissante, limités à `limit`.
 */
export function urgentGoals(goals: Goal[], limit = 2): Goal[] {
  return goals
    .filter((goal) => !goal.isAchieved)
    .sort((a, b) => a.targetDate - b.targetDate)
    .slice(0, limit);
}

/**
 * Réduit la répartition par catégorie au top `limit` éléments + une slice
 * « Autres » regroupant le reste (uniquement si du montant reste).
 */
export function topCategorySlices(
  breakdown: CategorySlice[],
  limit = 4,
): CategorySlice[] {
  const rest = breakdown.slice(limit);
  if (rest.length === 0) {
    return breakdown;
  }
  const grandTotal = breakdown.reduce((sum, slice) => sum + slice.total, 0);
  const restTotal = rest.reduce((sum, slice) => sum + slice.total, 0);
  return [
    ...breakdown.slice(0, limit),
    {
      categoryId: null,
      categoryName: "Autres",
      categoryIcon: null,
      total: restTotal,
      count: rest.reduce((sum, slice) => sum + slice.count, 0),
      pct: grandTotal === 0 ? 0 : (restTotal / grandTotal) * 100,
    },
  ];
}
