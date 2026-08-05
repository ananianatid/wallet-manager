import {
  buildImportPlan,
  IMPORT_ACCOUNT_CATEGORY,
  type MoneyManagerData,
} from "./money-manager";

function data(overrides: Partial<MoneyManagerData> = {}): MoneyManagerData {
  return {
    accounts: [
      { uid: "a1", name: "Banque A" },
      { uid: "a2", name: "Banque B" },
      { uid: "a3", name: null },
    ],
    categories: [
      { uid: "c1", name: "Salaire", type: 0 },
      { uid: "c2", name: "Nourriture", type: 1 },
      { uid: "c3", name: "Inutilisée", type: 1 },
    ],
    transactions: [
      {
        doType: 0,
        money: 100000,
        date: 1_700_000_000_000,
        note: null,
        categoryUid: "c1",
        accountUid: "a1",
        destinationUid: null,
      },
      {
        doType: 1,
        money: 25000,
        date: 1_700_000_100_000,
        note: "Courses",
        categoryUid: "c2",
        accountUid: "a2",
        destinationUid: null,
      },
      {
        doType: 3,
        money: 50000,
        date: 1_700_000_200_000,
        note: null,
        categoryUid: null,
        accountUid: "a1",
        destinationUid: "a2",
      },
    ],
    ...overrides,
  };
}

describe("buildImportPlan", () => {
  it("maps accounts to their Money Manager group", () => {
    const plan = buildImportPlan(
      data({
        groups: [{ uid: "g1", name: "Banque" }],
        accounts: [
          { uid: "a1", name: "Banque A", groupUid: "g1" },
          { uid: "a2", name: "Banque B" },
        ],
      }),
    );

    expect(plan.accounts).toEqual([
      { name: "Banque A", groupName: "Banque" },
      { name: "Banque B", groupName: null },
    ]);
  });

  it("puts every account into a single generic account category", () => {
    const plan = buildImportPlan(data());

    const accountCategories = plan.categories.filter(
      (c) => c.type === "account",
    );
    expect(accountCategories).toEqual([
      { type: "account", name: IMPORT_ACCOUNT_CATEGORY },
    ]);
  });

  it("uses the seeded « Espèces » category as generic default", () => {
    const plan = buildImportPlan(data());
    expect(IMPORT_ACCOUNT_CATEGORY).toBe("Espèces");
    expect(
      plan.categories.some(
        (c) => c.type === "account" && c.name === "Espèces",
      ),
    ).toBe(true);
  });

  it("keeps used income and expense categories and skips unused ones", () => {
    const plan = buildImportPlan(data());

    const incomeNames = plan.categories
      .filter((c) => c.type === "income")
      .map((c) => c.name);
    const expenseNames = plan.categories
      .filter((c) => c.type === "expense")
      .map((c) => c.name);

    expect(incomeNames).toEqual(["Salaire"]);
    expect(expenseNames).toEqual(["Nourriture"]);
  });

  it("falls back to « Autres » for transactions without a known category", () => {
    const plan = buildImportPlan(
      data({
        transactions: [
          {
            doType: 1,
            money: 1000,
            date: 1_700_000_000_000,
            note: null,
            categoryUid: "unknown",
            accountUid: "a1",
            destinationUid: null,
          },
        ],
      }),
    );

    const expenseNames = plan.categories
      .filter((c) => c.type === "expense")
      .map((c) => c.name);
    expect(expenseNames).toContain("Autres");
    expect(plan.transactions[0].categoryName).toBe("Autres");
  });

  it("excludes accounts without transactions from the plan", () => {
    const plan = buildImportPlan(data());
    expect(plan.accounts.map((a) => a.name)).toEqual(["Banque A", "Banque B"]);
  });
});
