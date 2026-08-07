/// <reference types="jest" />

import { render } from "@testing-library/react-native";
import { MonthlySummaryCard, SafeToSpendCard } from "./safe-to-spend-card";
import type { SafeToSpend } from "@/types";
import { formatAmount } from "@/utils/format";

jest.mock("lucide-react-native", () => ({
  ChevronRight: () => null,
}));

function makeData(amount: number): SafeToSpend {
  return {
    amount,
    currentAvailable: amount,
    horizonDate: Date.now(),
    nextIncomeDate: null,
    usesFallbackHorizon: true,
    plannedIncome: 120_000,
    plannedOutflows: 45_000,
    eventCount: 2,
    recurringEventCount: 1,
    futureTransactionCount: 1,
    savings: 0,
    suggestion: null,
  };
}

describe("SafeToSpendCard", () => {
  it("labels the summary total according to the selected period", async () => {
    const { getByText } = await render(
      <MonthlySummaryCard
        totals={{ income: 120_000, expense: 45_000, fees: 0, net: 75_000 }}
        totalLabel="Total de la période"
      />,
    );

    expect(getByText("Total de la période")).toBeTruthy();
  });

  it("hides period totals while the selected period is loading", async () => {
    const { getByText, queryByText } = await render(
      <MonthlySummaryCard
        totals={{ income: 120_000, expense: 45_000, fees: 0, net: 75_000 }}
        totalLabel="Total de la période"
        loading
      />,
    );

    expect(getByText("Calcul de la période…")).toBeTruthy();
    expect(queryByText("Revenus")).toBeNull();
  });

  it("uses a white amount and keeps the detailed footer visible for a positive balance", async () => {
    const { getAllByText, getByText } = await render(
      <SafeToSpendCard data={makeData(75_000)} interactive />,
    );

    expect(getAllByText(formatAmount(75_000, "XOF"))[0].props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "#FFFFFF" })]),
    );
    expect(getByText("Revenus")).toBeTruthy();
    expect(getByText("Dépenses")).toBeTruthy();
    expect(getByText("Solde")).toBeTruthy();
  });

  it("keeps the amount readable and shows the alert copy for a negative balance", async () => {
    const { getByText } = await render(
      <SafeToSpendCard data={makeData(-15_000)} interactive={false} />,
    );

    expect(getByText(formatAmount(-15_000, "XOF")).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "#FFFFFF" })]),
    );
    expect(
      getByText("Il manque 15 000 XOF pour couvrir les échéances prévues."),
    ).toBeTruthy();
  });

  it("preserves the compact presentation without the detailed footer", async () => {
    const { getByText, queryByText } = await render(
      <SafeToSpendCard
        data={makeData(30_000)}
        compact
        onPress={() => undefined}
      />,
    );

    expect(getByText("Appuyez pour voir le calcul détaillé.")).toBeTruthy();
    expect(queryByText("Revenus")).toBeNull();
    expect(getByText(formatAmount(30_000, "XOF")).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "#FFFFFF" })]),
    );
  });
});
