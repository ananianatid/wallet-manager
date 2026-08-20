import type { Budget, Goal } from "@/types";
import type { CategorySlice } from "@/utils/statistics";

export interface DashboardInsight {
  level: "calm" | "warning";
  title: string;
  body: string;
}

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

export function dashboardInsight({
  totalExpense,
  previousMonthExpense,
  hasCurrentActivity,
  hasPreviousActivity,
  budgetRemaining,
  hasOverBudget,
}: {
  totalExpense: number;
  previousMonthExpense: number;
  hasCurrentActivity: boolean;
  hasPreviousActivity: boolean;
  budgetRemaining: number | null;
  hasOverBudget: boolean;
}): DashboardInsight {
  if (budgetRemaining === 0) {
    return {
      level: "warning",
      title: "Budget épuisé ce mois-ci",
      body: "Votre budget restant est à 0. Vérifiez vos prochains paiements.",
    };
  }

  if (hasOverBudget) {
    return {
      level: "warning",
      title: "Budget à surveiller",
      body: "Un de vos budgets est dépassé. Vérifiez vos prochains paiements.",
    };
  }

  if (!hasCurrentActivity && !hasPreviousActivity) {
    return {
      level: "calm",
      title: "Votre suivi commence ici",
      body: "Ajoutez vos premières dépenses pour voir votre trajectoire.",
    };
  }

  if (previousMonthExpense > 0) {
    const change = Math.round(
      ((totalExpense - previousMonthExpense) / previousMonthExpense) * 100,
    );
    if (change < 0) {
      return {
        level: "calm",
        title: "Tout va bien ce mois-ci",
        body: `Vos dépenses sont ${Math.abs(change)} % plus faibles que le mois dernier. Vous êtes sur la bonne trajectoire.`,
      };
    }
    if (change > 0) {
      return {
        level: "warning",
        title: "À surveiller ce mois-ci",
        body: `Vos dépenses sont ${change} % plus élevées que le mois dernier. Vérifiez vos prochains paiements.`,
      };
    }
    return {
      level: "calm",
      title: "Continuez votre suivi",
      body: "Vos dépenses restent stables par rapport au mois dernier.",
    };
  }

  return {
    level: "calm",
    title: "Continuez votre suivi",
    body: totalExpense > 0
      ? "Vos dépenses commencent à se dessiner ce mois-ci."
      : "Ajoutez vos premières dépenses pour voir votre trajectoire.",
  };
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
