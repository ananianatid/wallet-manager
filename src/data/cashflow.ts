import { calculateSafeToSpend } from "@/db/cashflow";
import { getDatabase } from "@/db/database";
import type { CurrencyRate } from "@/currency/service";

export function loadCashflow(referenceCurrency: string, currencyRates: CurrencyRate[]) {
  return getDatabase().then((db) => calculateSafeToSpend(db, Date.now(), { referenceCurrency, currencyRates }));
}
