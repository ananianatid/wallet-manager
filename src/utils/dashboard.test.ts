/// <reference types="jest" />

import {
  budgetProgress,
  dashboardInsight,
  topCategorySlices,
  urgentGoals,
} from "./dashboard";
import { dashboardMetricTone } from "./financial-display";
import type { Budget, Goal } from "@/types";
import type { CategorySlice } from "@/utils/statistics";

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 1,
    categoryId: 10,
    categoryName: "Nourriture",
    categoryIcon: "utensils",
    amount: 100_000,
    currencyCode: "XOF",
    createdAt: 0,
    ...overrides,
  };
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 1,
    name: "Voyage",
    targetAmount: 1_000_000,
    currencyCode: "XOF",
    targetDate: 1_700_000_000_000,
    status: "active",
    createdAt: 0,
    reservedAmount: 250_000,
    remainingAmount: 750_000,
    progressPercent: 25,
    monthlyRequired: 100_000,
    isAchieved: false,
    isOverdue: false,
    ...overrides,
  };
}

function makeSlice(overrides: Partial<CategorySlice> = {}): CategorySlice {
  return {
    categoryId: 1,
    categoryName: "Nourriture",
    categoryIcon: "utensils",
    total: 50_000,
    count: 4,
    pct: 50,
    ...overrides,
  };
}

describe("budgetProgress", () => {
  it("calcule la progression d'un budget de catégorie", () => {
    const budgets = [makeBudget({ amount: 100_000 })];
    const spentByCategory = new Map([[10, 75_000]]);
    const rows = budgetProgress(budgets, spentByCategory, 200_000);

    expect(rows).toHaveLength(1);
    expect(rows[0].spent).toBe(75_000);
    expect(rows[0].pct).toBe(75);
    expect(rows[0].over).toBe(false);
  });

  it("utilise toutes les dépenses pour un budget global (sans catégorie)", () => {
    const budgets = [makeBudget({ categoryId: null, categoryName: null, amount: 100_000 })];
    const rows = budgetProgress(budgets, new Map(), 60_000);

    expect(rows[0].spent).toBe(60_000);
    expect(rows[0].pct).toBe(60);
  });

  it("plafonne le pourcentage à 100 et signale le dépassement", () => {
    const budgets = [makeBudget({ amount: 100_000 })];
    const rows = budgetProgress(budgets, new Map([[10, 120_000]]), 120_000);

    expect(rows[0].pct).toBe(100);
    expect(rows[0].over).toBe(true);
  });

  it("évite une division par zéro si le plafond est nul", () => {
    const budgets = [makeBudget({ amount: 0 })];
    const rows = budgetProgress(budgets, new Map([[10, 5_000]]), 5_000);

    expect(rows[0].pct).toBe(0);
    expect(rows[0].over).toBe(true);
  });
});

describe("dashboardMetricTone", () => {
  it("colore les métriques de l'Accueil selon leur rôle", () => {
    expect(dashboardMetricTone("expense", 25_000)).toBe("expense");
    expect(dashboardMetricTone("budgetRemaining", 10_000)).toBe("income");
    expect(dashboardMetricTone("budgetRemaining", 0)).toBe("expense");
    expect(dashboardMetricTone("savings", 5_000)).toBe("accent");
    expect(dashboardMetricTone("upcoming", 1)).toBe("warning");
  });

  it("reste neutre en l'absence de donnée ou de montant", () => {
    expect(dashboardMetricTone("expense", 0)).toBe("neutral");
    expect(dashboardMetricTone("savings", 0)).toBe("neutral");
    expect(dashboardMetricTone("budgetRemaining", null)).toBe("neutral");
    expect(dashboardMetricTone("upcoming", null)).toBe("neutral");
  });
});

describe("dashboardInsight", () => {
  it("priorise l'alerte quand le budget est épuisé", () => {
    expect(
      dashboardInsight({
        totalExpense: 112_000,
        previousMonthExpense: 100_000,
        hasCurrentActivity: true,
        hasPreviousActivity: true,
        budgetRemaining: 0,
        hasOverBudget: false,
      }),
    ).toEqual({
      level: "warning",
      title: "Budget épuisé ce mois-ci",
      body: "Votre budget restant est à 0. Vérifiez vos prochains paiements.",
    });
  });

  it("signale une hausse des dépenses sans budget épuisé", () => {
    expect(
      dashboardInsight({
        totalExpense: 112_000,
        previousMonthExpense: 100_000,
        hasCurrentActivity: true,
        hasPreviousActivity: true,
        budgetRemaining: 20_000,
        hasOverBudget: false,
      }),
    ).toMatchObject({ level: "warning", title: "À surveiller ce mois-ci" });
  });

  it("garde un état calme sans activité", () => {
    expect(
      dashboardInsight({
        totalExpense: 0,
        previousMonthExpense: 0,
        hasCurrentActivity: false,
        hasPreviousActivity: false,
        budgetRemaining: null,
        hasOverBudget: false,
      }),
    ).toMatchObject({ level: "calm", title: "Votre suivi commence ici" });
  });
});

describe("urgentGoals", () => {
  it("ignore les objectifs atteints", () => {
    const reached = makeGoal({ id: 1, targetDate: 1_000, isAchieved: true });
    const active = makeGoal({ id: 2, targetDate: 2_000 });
    expect(urgentGoals([reached, active])).toEqual([active]);
  });

  it("trie par échéance croissante et limite à 2", () => {
    const far = makeGoal({ id: 1, targetDate: 3_000 });
    const near = makeGoal({ id: 2, targetDate: 1_000 });
    const middle = makeGoal({ id: 3, targetDate: 2_000 });
    expect(urgentGoals([far, near, middle])).toEqual([near, middle]);
  });

  it("ne renvoie que les objectifs disponibles si moins de 2", () => {
    const only = makeGoal({ id: 1 });
    expect(urgentGoals([only])).toEqual([only]);
    expect(urgentGoals([])).toEqual([]);
  });
});

describe("topCategorySlices", () => {
  it("retourne la répartition inchangée si elle tient dans la limite", () => {
    const slices = [makeSlice({ total: 60_000, pct: 60 }), makeSlice({ total: 40_000, pct: 40 })];
    expect(topCategorySlices(slices)).toEqual(slices);
  });

  it("groupe le reste dans une slice « Autres »", () => {
    const slices = [
      makeSlice({ categoryId: 1, categoryName: "A", total: 40_000 }),
      makeSlice({ categoryId: 2, categoryName: "B", total: 30_000 }),
      makeSlice({ categoryId: 3, categoryName: "C", total: 20_000 }),
      makeSlice({ categoryId: 4, categoryName: "D", total: 5_000 }),
      makeSlice({ categoryId: 5, categoryName: "E", total: 5_000 }),
    ];
    const result = topCategorySlices(slices);

    expect(result).toHaveLength(5);
    const rest = result[4];
    expect(rest.categoryName).toBe("Autres");
    expect(rest.categoryId).toBeNull();
    expect(rest.total).toBe(5_000);
    expect(rest.pct).toBe(5);
  });

  it("préserve l'ordre de la répartition (déjà triée par categoryBreakdown)", () => {
    const slices = [
      makeSlice({ categoryName: "Grand", total: 90_000 }),
      makeSlice({ categoryName: "Moyen", total: 50_000 }),
      makeSlice({ categoryName: "Petit", total: 10_000 }),
    ];
    const names = topCategorySlices(slices).map((s) => s.categoryName);
    expect(names).toEqual(["Grand", "Moyen", "Petit"]);
  });
});
