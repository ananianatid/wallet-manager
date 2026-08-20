/// <reference types="jest" />

import { render } from "@testing-library/react-native";
import { getThemePalette } from "@/theme";
import { formatAmount } from "@/utils/format";
import { TransactionRow } from "./transaction-row";

jest.mock("lucide-react-native", () => ({
  ArrowLeftRight: () => null,
}));

jest.mock("@/components/category-icons", () => ({
  CategoryIcon: () => null,
}));

const expense = {
  id: 1,
  type: "expense" as const,
  amount: 1_000,
  categoryId: 2,
  categoryName: "Nourriture",
  categoryIcon: null,
  accountId: 1,
  accountName: "Compte courant",
  accountCurrencyCode: "XOF",
  destinationAccountId: null,
  destinationAccountName: null,
  destinationCurrencyCode: null,
  fee: null,
  note: null,
  transactionDate: Date.now(),
  createdAt: Date.now(),
};

describe("TransactionRow", () => {
  it("affiche le montant d'une dépense en rouge", async () => {
    const { getByText } = await render(<TransactionRow transaction={expense} />);

    expect(getByText(`−${formatAmount(expense.amount, "XOF")}`).props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: getThemePalette("light").expense }),
      ]),
    );
  });
});
