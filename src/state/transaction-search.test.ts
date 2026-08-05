import {
  getTransactionSearch,
  resetTransactionSearch,
  setTransactionSearch,
} from "./transaction-search";

describe("transaction search session state", () => {
  afterEach(() => {
    resetTransactionSearch();
  });

  it("keeps criteria during the session and clones selection arrays", () => {
    const accountIds = [2, 4];
    setTransactionSearch({
      query: "Flooz",
      startDate: 1_700_000_000_000,
      endDate: null,
      minAmount: 50_000,
      maxAmount: null,
      accountIds,
      types: ["expense"],
      categoryIds: null,
    });

    accountIds.push(9);
    expect(getTransactionSearch()).toMatchObject({
      query: "Flooz",
      minAmount: 50_000,
      accountIds: [2, 4],
      types: ["expense"],
    });
  });

  it("resets every criterion to the unfiltered search", () => {
    setTransactionSearch({
      query: "ancienne recherche",
      startDate: 1,
      endDate: 2,
      minAmount: 1,
      maxAmount: 2,
      accountIds: [],
      types: [],
      categoryIds: [],
    });

    expect(resetTransactionSearch()).toEqual({
      query: "",
      startDate: null,
      endDate: null,
      minAmount: null,
      maxAmount: null,
      accountIds: null,
      types: ["income", "expense", "transfer"],
      categoryIds: null,
    });
  });
});
