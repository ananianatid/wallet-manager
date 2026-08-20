/// <reference types="jest" />

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { ReactNode } from "react";
import NewTransactionScreen, { resolveInitialTransactionType } from "@/app/new-transaction";

jest.mock("lucide-react-native", () => ({
  ArrowDownLeft: () => null,
  ArrowLeftRight: () => null,
  ArrowUpRight: () => null,
  ChevronDown: () => null,
  ChevronUp: () => null,
}));

let mockParams: { id?: string; goalId?: string; type?: string } = {};

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  return {
    router: { back: jest.fn() },
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
    useLocalSearchParams: jest.fn(),
  };
});

jest.mock("expo-router/stack", () => ({
  Stack: { Screen: () => null },
}));

jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/db/database", () => ({
  getDatabase: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/db/accounts", () => ({
  listAccountsByUsage: jest.fn(),
}));

jest.mock("@/db/categories", () => ({
  listCategoriesByUsage: jest.fn(),
}));

jest.mock("@/db/goals", () => ({
  createGoalReservation: jest.fn(),
  listGoals: jest.fn(),
}));

jest.mock("@/db/transactions", () => ({
  createTransaction: jest.fn(),
  deleteTransaction: jest.fn(),
  getTransaction: jest.fn(),
  getTransactionDetail: jest.fn(),
  updateTransaction: jest.fn(),
}));

jest.mock("@/currency/service", () => ({
  getRateForPair: jest.fn(),
}));

jest.mock("@/utils/logger", () => ({
  log: { error: jest.fn() },
}));

jest.mock("@/components/select-field", () => ({
  SelectField: (props: {
    label: string;
    value: string | null;
    options: { id: number; label: string }[];
    onChange: (id: number) => void;
  }) => {
    const React = jest.requireActual("react");
    const { Pressable: MockPressable, Text: MockText } = jest.requireActual("react-native");
    return React.createElement(
      MockPressable,
      {
        accessibilityRole: "combobox",
        accessibilityLabel: props.label,
        accessibilityValue: { text: props.value ?? "Aucune sélection" },
        onPress: () => {
          if (props.options[0]) {
            props.onChange(props.options[0].id);
          }
        },
      },
      React.createElement(MockText, null, props.value ?? "Sélectionner…"),
    );
  },
}));

jest.mock("@/components/ui", () => {
  const actual = jest.requireActual("@/components/ui");
  const React = jest.requireActual("react");
  const { View: MockView } = jest.requireActual("react-native");
  return {
    ...actual,
    KeyboardAwareScreen: ({ children }: { children: ReactNode }) =>
      React.createElement(MockView, null, children),
  };
});

const mockRouter = (jest.requireMock("expo-router") as {
  router: { back: jest.Mock };
}).router;
const mockUseLocalSearchParams = (jest.requireMock("expo-router") as {
  useLocalSearchParams: jest.Mock;
}).useLocalSearchParams;
const mockCreateTransaction = (jest.requireMock("@/db/transactions") as {
  createTransaction: jest.Mock;
}).createTransaction;
const mockCreateGoalReservation = (jest.requireMock("@/db/goals") as {
  createGoalReservation: jest.Mock;
}).createGoalReservation;
const mockGetTransaction = (jest.requireMock("@/db/transactions") as {
  getTransaction: jest.Mock;
}).getTransaction;
const mockGetTransactionDetail = (jest.requireMock("@/db/transactions") as {
  getTransactionDetail: jest.Mock;
}).getTransactionDetail;
const mockListAccountsByUsage = (jest.requireMock("@/db/accounts") as {
  listAccountsByUsage: jest.Mock;
}).listAccountsByUsage;
const mockListCategoriesByUsage = (jest.requireMock("@/db/categories") as {
  listCategoriesByUsage: jest.Mock;
}).listCategoriesByUsage;
const mockListGoals = (jest.requireMock("@/db/goals") as {
  listGoals: jest.Mock;
}).listGoals;

const account = {
  id: 1,
  name: "Compte courant",
  groupId: null,
  groupName: null,
  hidden: false,
  excludeFromTotal: false,
  description: null,
  currencyCode: "XOF",
  createdAt: 1,
  balance: 0,
  reservedAmount: 0,
  availableBalance: 0,
};

const categories = [
  { id: 2, type: "expense", name: "Nourriture", isSeed: true, icon: null },
  { id: 3, type: "income", name: "Salaire", isSeed: true, icon: null },
];

async function renderScreen() {
  const screen = await render(<NewTransactionScreen />);
  await waitFor(() => expect(screen.getByText("Compte courant · XOF")).toBeTruthy());
  return screen;
}

async function fillExpense(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.changeText(screen.getByLabelText("Montant en XOF"), "1000");
  await fireEvent.press(screen.getByRole("combobox", { name: "Catégorie" }));
  await waitFor(() => expect(screen.getByText("Nourriture")).toBeTruthy());
}

async function pressSave(
  screen: Awaited<ReturnType<typeof render>>,
  label: string,
) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
}

describe("NewTransactionScreen", () => {
  beforeEach(() => {
    mockParams = {};
    mockUseLocalSearchParams.mockImplementation(() => mockParams);
    mockRouter.back.mockReset();
    mockCreateTransaction.mockReset().mockResolvedValue(1);
    mockCreateGoalReservation.mockReset().mockResolvedValue(1);
    mockGetTransaction.mockReset().mockResolvedValue(null);
    mockGetTransactionDetail.mockReset().mockResolvedValue(null);
    mockListAccountsByUsage.mockReset().mockResolvedValue([account]);
    mockListCategoriesByUsage.mockReset().mockResolvedValue(categories);
    mockListGoals.mockReset().mockResolvedValue([]);
  });

  it.each([
    [undefined, undefined, "expense"],
    ["income", undefined, "income"],
    ["transfer", undefined, "transfer"],
    [undefined, "7", "transfer"],
  ] as const)("resolves the initial type from navigation params", (type, goalId, expected) => {
    expect(resolveInitialTransactionType(type, goalId)).toBe(expected);
  });

  it("opens directly on the expense tab", async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText("Montant en XOF")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dépense" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dépense" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("tab", { name: "Revenu" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Transfert" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Afficher les options avancées" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enregistrer et continuer" })).toBeTruthy();
  });

  it("reveals advanced fields only on request", async () => {
    const screen = await renderScreen();

    expect(screen.queryByText("Marchand (optionnel)")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Afficher les options avancées" }));
    expect(screen.getByText("Marchand (optionnel)")).toBeTruthy();
    expect(screen.getByText("Tags (optionnels)")).toBeTruthy();
    expect(screen.getByText("Fractionner")).toBeTruthy();
    expect(screen.getByText("Remboursement")).toBeTruthy();
  });

  it("switches the form through the transaction tabs", async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByRole("tab", { name: "Revenu" }));
    expect(screen.getByLabelText("Montant en XOF")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Afficher les options avancées" }));
    expect(screen.queryByText("Remboursement")).toBeNull();

    await fireEvent.press(screen.getByRole("tab", { name: "Transfert" }));
    expect(screen.getByLabelText("Montant débité en XOF")).toBeTruthy();
    expect(screen.getByText("Compte de destination")).toBeTruthy();
  });

  it("keeps the income shortcut mode in the form", async () => {
    mockParams = { type: "income" };
    const screen = await renderScreen();

    await fireEvent.press(screen.getByRole("combobox", { name: "Catégorie" }));

    expect(screen.getByText("Salaire")).toBeTruthy();
    expect(screen.queryByText("Nourriture")).toBeNull();
  });

  it("keeps the transfer shortcut mode in the form", async () => {
    mockParams = { type: "transfer" };
    const screen = await renderScreen();

    expect(screen.getByLabelText("Montant débité en XOF")).toBeTruthy();
    expect(screen.getByText("Compte de destination")).toBeTruthy();
  });

  it("keeps goal launches in transfer mode", async () => {
    mockParams = { goalId: "7" };
    const screen = await renderScreen();

    expect(screen.getByLabelText("Montant débité en XOF")).toBeTruthy();
    expect(screen.getByText("Réserver vers un objectif (optionnel)")).toBeTruthy();
  });

  it("saves and closes with Enregistrer", async () => {
    const screen = await renderScreen();
    await fillExpense(screen);

    await pressSave(screen, "Enregistrer");

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
  });

  it("saves and resets the form with Enregistrer et continuer", async () => {
    const screen = await renderScreen();
    await fillExpense(screen);

    await pressSave(screen, "Enregistrer et continuer");

    await waitFor(() =>
      expect(screen.getByText("Transaction enregistrée. Vous pouvez en ajouter une autre.")).toBeTruthy(),
    );
    expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Montant en XOF").props.value).toBe("");
    expect(screen.getByText("Compte courant · XOF")).toBeTruthy();
  });

  it("only offers Enregistrer while editing", async () => {
    mockParams = { id: "42" };
    mockGetTransactionDetail.mockResolvedValue({
      transaction: {
        id: 42,
        type: "expense",
        amount: 1000,
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
        destinationAmount: null,
        exchangeRate: null,
        exchangeRateDate: null,
        exchangeRateProvider: null,
        note: null,
        merchant: null,
        transactionDate: Date.now(),
        createdAt: Date.now(),
      },
      splits: [],
      reimbursements: [],
      tags: [],
      attachments: [],
    });

    const screen = await renderScreen();

    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer et continuer" })).toBeNull();
  });

  it("keeps the form values when saving fails", async () => {
    mockCreateTransaction.mockRejectedValueOnce(new Error("SQLite indisponible"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const screen = await renderScreen();
    await fillExpense(screen);

    await pressSave(screen, "Enregistrer et continuer");

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByLabelText("Montant en XOF").props.value).toBe("1000");
    expect(mockRouter.back).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
