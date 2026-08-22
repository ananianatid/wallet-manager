import {
  prepareTransactionEditorDraft,
  toTransactionInput,
  TransactionEditorValidationError,
  type TransactionEditorDraft,
} from "./editor";

const draft = (overrides: Partial<TransactionEditorDraft> = {}): TransactionEditorDraft => ({
  type: "expense",
  amount: "1250",
  sourceCurrency: "XOF",
  accountId: 7,
  categoryId: 3,
  splitEnabled: false,
  splitRows: [],
  reimbursementEnabled: false,
  reimbursementPerson: "",
  reimbursementDirection: "owed_to_me",
  reimbursementAmount: "",
  destinationId: null,
  goalReservationId: null,
  fee: "",
  feeMode: "manual",
  debitedAmount: "",
  destinationAmount: "",
  destinationCurrency: "XOF",
  destinationEdited: false,
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateProvider: null,
  note: "",
  merchant: "",
  tags: [],
  transactionDate: 1_700_000_000_000,
  ...overrides,
});

describe("transaction editor interface", () => {
  it("prepares a simple expense and preserves normalized text fields", () => {
    const prepared = prepareTransactionEditorDraft(draft({ note: "  déjeuner ", merchant: "  Marché " }));
    const input = toTransactionInput(draft({ note: "  déjeuner ", merchant: "  Marché " }), prepared);

    expect(prepared.amount).toBe(1250);
    expect(input.note).toBe("déjeuner");
    expect(input.merchant).toBe("Marché");
    expect(input.accountId).toBe(7);
  });

  it("reports the first invalid field through its interface", () => {
    expect(() => prepareTransactionEditorDraft(draft({ amount: "" }))).toThrow(
      new TransactionEditorValidationError("amount", "Saisissez un montant valide en XOF."),
    );
  });

  it("requires split rows to reconcile exactly with the transaction amount", () => {
    expect(() => prepareTransactionEditorDraft(draft({
      splitEnabled: true,
      splitRows: [{ categoryId: 3, amount: "1000" }],
    }))).toThrow("La somme des répartitions doit être exactement égale au montant.");
  });

  it("accepts a manually entered cross-currency transfer", () => {
    const prepared = prepareTransactionEditorDraft(draft({
      type: "transfer",
      categoryId: null,
      destinationId: 9,
      destinationAmount: "3",
      destinationCurrency: "EUR",
      destinationEdited: true,
    }));

    expect(prepared.destinationAccountId).toBe(9);
    expect(prepared.destinationAmount).toBe(300);
    expect(prepared.exchangeRateProvider).toBe("manual");
    expect(prepared.exchangeRate).toBeGreaterThan(0);
  });
});
