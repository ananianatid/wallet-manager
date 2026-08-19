import type { Goal } from "@/types";

export interface GoalTotals {
  target: number;
  reserved: number;
  remaining: number;
}

export function goalTotals(
  goals: Goal[],
  convert: (amount: number, currencyCode: string) => number | null,
): GoalTotals {
  return goals
    .filter((goal) => goal.status === "active")
    .reduce(
      (totals, goal) => {
        totals.target += convert(goal.targetAmount, goal.currencyCode) ?? 0;
        totals.reserved += convert(goal.reservedAmount, goal.currencyCode) ?? 0;
        totals.remaining += convert(goal.remainingAmount, goal.currencyCode) ?? 0;
        return totals;
      },
      { target: 0, reserved: 0, remaining: 0 },
    );
}

export function isValidGoalLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
