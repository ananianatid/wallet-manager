import type { Goal } from "@/types";
import { goalTotals, isValidGoalLink } from "./goals";

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 1,
    name: "Voyage",
    targetAmount: 1_000,
    currencyCode: "XOF",
    targetDate: Date.now() + 86_400_000,
    status: "active",
    createdAt: 0,
    reservedAmount: 250,
    remainingAmount: 750,
    progressPercent: 25,
    monthlyRequired: 750,
    isAchieved: false,
    isOverdue: false,
    ...overrides,
  };
}

describe("goal utilities", () => {
  it("additionne les objectifs actifs dans la devise de référence", () => {
    const totals = goalTotals(
      [
        makeGoal(),
        makeGoal({ id: 2, targetAmount: 2_000, reservedAmount: 1_000, remainingAmount: 1_000 }),
        makeGoal({ id: 3, status: "closed" }),
      ],
      (amount, currency) => (currency === "USD" ? amount * 600 : amount),
    );

    expect(totals).toEqual({ target: 3_000, reserved: 1_250, remaining: 1_750 });
  });

  it("accepte uniquement les liens HTTP et HTTPS", () => {
    expect(isValidGoalLink("https://example.com/item")).toBe(true);
    expect(isValidGoalLink("http://example.com")).toBe(true);
    expect(isValidGoalLink("example.com")).toBe(false);
    expect(isValidGoalLink("javascript:alert(1)")).toBe(false);
  });
});
