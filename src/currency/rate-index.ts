import { convertMinorAmount } from "./currencies";
import type { CurrencyRate } from "./service";

export interface IndexedCurrencyRates {
  direct: Map<string, number>;
  byQuote: Map<string, { base: string; rate: number }>;
}

export function indexCurrencyRates(rates: readonly CurrencyRate[]): IndexedCurrencyRates {
  const direct = new Map<string, number>();
  const byQuote = new Map<string, { base: string; rate: number }>();
  for (const rate of rates) {
    direct.set(`${rate.base}:${rate.quote}`, rate.rate);
    byQuote.set(rate.quote, { base: rate.base, rate: rate.rate });
  }
  return { direct, byQuote };
}

export function convertWithIndexedRates(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  indexedRates: IndexedCurrencyRates,
): number | null {
  if (fromCurrency === toCurrency) return amount;
  const directRate = indexedRates.direct.get(`${fromCurrency}:${toCurrency}`);
  if (directRate != null) {
    return convertMinorAmount(amount, fromCurrency, toCurrency, directRate);
  }
  const baseRate = indexedRates.byQuote.get(fromCurrency);
  const targetRate = indexedRates.byQuote.get(toCurrency);
  if (!baseRate || !targetRate || baseRate.rate === 0 || targetRate.base !== baseRate.base) {
    return null;
  }
  return convertMinorAmount(
    amount,
    fromCurrency,
    toCurrency,
    targetRate.rate / baseRate.rate,
  );
}
