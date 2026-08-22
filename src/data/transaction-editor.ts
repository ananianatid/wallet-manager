import { getRateForPair } from "@/currency/service";
import { getDatabase } from "@/db/database";
import { saveTransactionWorkflow, type SaveTransactionCommand, type SaveTransactionResult } from "@/db/transaction-workflow";

export function loadLocalExchangeRate(
  sourceCurrency: string,
  destinationCurrency: string,
  options: Parameters<typeof getRateForPair>[3],
) {
  return getDatabase().then((db) => getRateForPair(db, sourceCurrency, destinationCurrency, options));
}

export function saveLocalTransaction(command: SaveTransactionCommand): Promise<SaveTransactionResult> {
  return getDatabase().then((db) => saveTransactionWorkflow(db, command));
}
