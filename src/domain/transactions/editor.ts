import { calculateRateFromMinor, parseMoneyInput } from "@/currency/currencies";
import { calculateTransferFee } from "@/utils/transfer-fees";
import type { ReimbursementDirection, TransactionInput, TransactionType } from "@/types";

export interface TransactionEditorSplitRow {
  categoryId: number | null;
  amount: string;
}

export interface TransactionEditorDraft {
  type: TransactionType;
  amount: string;
  sourceCurrency: string;
  accountId: number | null;
  categoryId: number | null;
  splitEnabled: boolean;
  splitRows: TransactionEditorSplitRow[];
  reimbursementEnabled: boolean;
  reimbursementPerson: string;
  reimbursementDirection: ReimbursementDirection;
  reimbursementAmount: string;
  destinationId: number | null;
  goalReservationId: number | null;
  fee: string;
  feeMode: "manual" | "calculated";
  debitedAmount: string;
  destinationAmount: string;
  destinationCurrency: string;
  destinationEdited: boolean;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  exchangeRateProvider: string | null;
  note: string;
  merchant: string;
  tags: string[];
  transactionDate: number;
}

export class TransactionEditorValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "TransactionEditorValidationError";
  }
}

export interface PreparedTransaction {
  amount: number;
  categoryId: number | null;
  destinationAccountId: number | null;
  fee: number | null;
  destinationAmount: number | null;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  exchangeRateProvider: string | null;
  allocations?: { categoryId: number; amount: number }[];
  reimbursements?: {
    personName: string;
    direction: ReimbursementDirection;
    amount: number;
  }[];
}

export function prepareTransactionEditorDraft(
  draft: TransactionEditorDraft,
): PreparedTransaction {
  const parsedAmount = parseMoneyInput(draft.amount, draft.sourceCurrency);
  if (parsedAmount == null || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new TransactionEditorValidationError(
      "amount",
      `Saisissez un montant valide en ${draft.sourceCurrency}.`,
    );
  }
  if (draft.accountId == null) {
    throw new TransactionEditorValidationError("account", "Choisissez un compte.");
  }
  if (draft.type !== "transfer" && draft.categoryId == null && !draft.splitEnabled) {
    throw new TransactionEditorValidationError("category", "Choisissez une catégorie.");
  }

  let allocations: PreparedTransaction["allocations"];
  if (draft.splitEnabled) {
    if (draft.type === "transfer") {
      throw new TransactionEditorValidationError("category", "Un transfert ne peut pas être fractionné.");
    }
    allocations = draft.splitRows.map((row) => {
      const amount = parseMoneyInput(row.amount, draft.sourceCurrency);
      if (row.categoryId == null || amount == null || !Number.isInteger(amount) || amount <= 0) {
        throw new TransactionEditorValidationError(
          "split",
          "Chaque répartition doit avoir une catégorie et un montant positif.",
        );
      }
      return { categoryId: row.categoryId, amount };
    });
    if (allocations.length === 0 || allocations.reduce((total, row) => total + row.amount, 0) !== parsedAmount) {
      throw new TransactionEditorValidationError("split", "La somme des répartitions doit être exactement égale au montant.");
    }
  }

  let reimbursements: PreparedTransaction["reimbursements"];
  if (draft.reimbursementEnabled) {
    const amount = parseMoneyInput(draft.reimbursementAmount, draft.sourceCurrency);
    if (!draft.reimbursementPerson.trim() || amount == null || !Number.isInteger(amount) || amount <= 0) {
      throw new TransactionEditorValidationError("reimbursement", "Saisissez une personne et un montant positif.");
    }
    reimbursements = [{
      personName: draft.reimbursementPerson.trim(),
      direction: draft.reimbursementDirection,
      amount,
    }];
  }

  if (draft.type === "transfer" && draft.destinationId == null && draft.goalReservationId == null) {
    throw new TransactionEditorValidationError("destination", "Choisissez un compte de destination ou un objectif.");
  }

  let parsedFee: number | null = draft.fee.trim()
    ? parseMoneyInput(draft.fee, draft.sourceCurrency)
    : null;
  if (draft.type === "transfer" && draft.goalReservationId == null && draft.feeMode === "calculated") {
    const parsedDebitedAmount = parseMoneyInput(draft.debitedAmount, draft.sourceCurrency);
    if (parsedDebitedAmount == null || Number.isNaN(parsedDebitedAmount)) {
      throw new TransactionEditorValidationError("debitedAmount", `Saisissez le total débité en ${draft.sourceCurrency}.`);
    }
    try {
      const computedFee = calculateTransferFee(parsedDebitedAmount, parsedAmount);
      parsedFee = computedFee > 0 ? computedFee : null;
    } catch (error) {
      throw new TransactionEditorValidationError(
        "debitedAmount",
        error instanceof Error && /Saisissez|positif/.test(error.message)
          ? error.message
          : "Le total débité est invalide.",
      );
    }
  }

  let parsedDestinationAmount: number | null = null;
  let savedExchangeRate: number | null = null;
  let savedExchangeRateDate: string | null = null;
  let savedExchangeRateProvider: string | null = null;
  if (draft.type === "transfer" && draft.destinationId != null) {
    const crossCurrency = draft.sourceCurrency !== draft.destinationCurrency;
    parsedDestinationAmount = crossCurrency
      ? parseMoneyInput(draft.destinationAmount, draft.destinationCurrency)
      : parsedAmount;
    if (parsedDestinationAmount == null || Number.isNaN(parsedDestinationAmount) || parsedDestinationAmount <= 0) {
      throw new TransactionEditorValidationError("destinationAmount", `Saisissez le montant crédité en ${draft.destinationCurrency}.`);
    }
    savedExchangeRate = crossCurrency
      ? draft.destinationEdited
        ? calculateRateFromMinor(parsedAmount, draft.sourceCurrency, parsedDestinationAmount, draft.destinationCurrency)
        : draft.exchangeRate
      : 1;
    savedExchangeRateDate = crossCurrency
      ? draft.destinationEdited
        ? new Date().toISOString().slice(0, 10)
        : draft.exchangeRateDate
      : new Date().toISOString().slice(0, 10);
    savedExchangeRateProvider = crossCurrency
      ? draft.destinationEdited
        ? "manual"
        : draft.exchangeRateProvider
      : "same currency";
    if (!savedExchangeRate || !savedExchangeRateDate || !savedExchangeRateProvider) {
      throw new TransactionEditorValidationError("destinationAmount", "Le taux de change est indisponible. Actualisez ou saisissez un montant.");
    }
  }

  if (draft.type === "transfer" && draft.goalReservationId == null && draft.feeMode === "manual" && parsedFee != null && (!Number.isInteger(parsedFee) || parsedFee <= 0)) {
    throw new TransactionEditorValidationError("fee", "Les frais doivent être un entier positif.");
  }

  const isGoalReservation = draft.type === "transfer" && draft.goalReservationId != null;
  const input: PreparedTransaction = {
    amount: parsedAmount,
    categoryId: draft.splitEnabled ? null : draft.categoryId,
    destinationAccountId: draft.type === "transfer" && draft.destinationId != null ? draft.destinationId : null,
    fee: draft.type === "transfer" && !isGoalReservation ? parsedFee : null,
    destinationAmount: isGoalReservation ? null : parsedDestinationAmount,
    exchangeRate: isGoalReservation ? null : savedExchangeRate,
    exchangeRateDate: isGoalReservation ? null : savedExchangeRateDate,
    exchangeRateProvider: isGoalReservation ? null : savedExchangeRateProvider,
    allocations,
    reimbursements,
  };
  return input;
}

export function toTransactionInput(
  draft: TransactionEditorDraft,
  prepared: PreparedTransaction,
): TransactionInput {
  return {
    type: draft.type,
    amount: prepared.amount,
    categoryId: prepared.categoryId,
    accountId: draft.accountId!,
    destinationAccountId: prepared.destinationAccountId,
    fee: prepared.fee,
    destinationAmount: prepared.destinationAmount,
    exchangeRate: prepared.exchangeRate,
    exchangeRateDate: prepared.exchangeRateDate,
    exchangeRateProvider: prepared.exchangeRateProvider,
    note: draft.note.trim() || null,
    transactionDate: draft.transactionDate,
    merchant: draft.merchant.trim() || null,
    tags: draft.tags,
    allocations: prepared.allocations,
    reimbursements: prepared.reimbursements,
  };
}
