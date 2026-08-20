import type { ThemeColors } from "@/theme";

export type FinancialTone =
  | "neutral"
  | "income"
  | "expense"
  | "accent"
  | "warning";

export type DashboardMetric =
  | "expense"
  | "budgetRemaining"
  | "savings"
  | "upcoming";

/** Retourne le ton sémantique d'un montant signé. */
export function signedAmountTone(value: number): FinancialTone {
  if (value < 0) {
    return "expense";
  }
  if (value > 0) {
    return "income";
  }
  return "neutral";
}

/** Retourne le ton d'une métrique synthétique de l'Accueil. */
export function dashboardMetricTone(
  metric: DashboardMetric,
  value: number | null,
): FinancialTone {
  if (value == null) {
    return "neutral";
  }

  if (metric === "expense") {
    return value > 0 ? "expense" : "neutral";
  }
  if (metric === "budgetRemaining") {
    return value <= 0 ? "expense" : "income";
  }
  if (metric === "savings") {
    return value > 0 ? "accent" : "neutral";
  }
  return "warning";
}

/** Convertit un ton sémantique en couleur du thème actif. */
export function financialToneColor(
  tone: FinancialTone,
  theme: ThemeColors,
): string {
  switch (tone) {
    case "income":
      return theme.income;
    case "expense":
      return theme.expense;
    case "accent":
      return theme.accent;
    case "warning":
      return theme.warning;
    default:
      return theme.secondaryLabel;
  }
}
