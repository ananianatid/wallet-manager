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
    balanceBeforeCalculation: amount,
    currentAvailable: amount,
    includedAccountCount: 1,
    excludedAccountCount: 0,
    horizonDate: Date.now(),
    nextIncomeDate: null,
    usesFallbackHorizon: true,
    plannedIncome: 120_000,
    plannedOutflows: 45_000,
    eventCount: 2,
    recurringEventCount: 1,
    futureTransactionCount: 1,
    savings: 0,
    overdraft: 0,
    overdraftAccountCount: 0,
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

  it("keeps the compact presentation focused on the amount", async () => {    const { getByText, queryByText } = await render(
      <SafeToSpendCard
        data={makeData(30_000)}
        compact
        onPress={() => undefined}
      />,
    );

    expect(queryByText("Ce que vous pouvez dépenser après les sommes réservées et les échéances prévues.")).toBeNull();
    expect(queryByText("Voir le détail du calcul.")).toBeNull();
    expect(queryByText(/Horizon/)).toBeNull();
    expect(queryByText(/compte.*inclus/)).toBeNull();
    expect(queryByText("Revenus")).toBeNull();
    expect(getByText(formatAmount(30_000, "XOF")).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "#FFFFFF" })]),
    );
  });

  it("shows the balance before calculation when provided", async () => {
    const data = makeData(75_000);
    const { getByText } = await render(
      <SafeToSpendCard data={data} interactive={false} />,
    );

    expect(getByText(`Solde avant calcul : ${formatAmount(data.balanceBeforeCalculation, "XOF")}`)).toBeTruthy();
  });

  it("hides the balance before calculation when missing", async () => {
    const data = makeData(75_000) as SafeToSpend & { balanceBeforeCalculation?: number };
    delete (data as { balanceBeforeCalculation?: number }).balanceBeforeCalculation;
    const { queryByText } = await render(
      <SafeToSpendCard data={data} interactive={false} />,
    );

    expect(queryByText(/Solde avant calcul/)).toBeNull();
  });
});
