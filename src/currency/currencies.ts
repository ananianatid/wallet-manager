export const DEFAULT_CURRENCY_CODE = "XOF";

export interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string | null;
  digits: number;
}

const FALLBACK_CURRENCIES: [string, string, string | null][] = [
  ["XOF", "Franc CFA BCEAO", "F CFA"],
  ["EUR", "Euro", "€"],
  ["USD", "Dollar des États-Unis", "$"],
  ["GBP", "Livre sterling", "£"],
  ["CAD", "Dollar canadien", "$"],
  ["CHF", "Franc suisse", "CHF"],
  ["CNY", "Yuan renminbi chinois", "¥"],
  ["JPY", "Yen japonais", "¥"],
  ["NGN", "Naira nigérian", "₦"],
  ["GHS", "Cedi ghanéen", "₵"],
  ["MAD", "Dirham marocain", "د.م."],
  ["ZAR", "Rand sud-africain", "R"],
];

function getDigits(code: string): number {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export const FALLBACK_CURRENCY_DEFINITIONS: CurrencyDefinition[] =
  FALLBACK_CURRENCIES.map(([code, name, symbol]) => ({
    code,
    name,
    symbol,
    digits: getDigits(code),
  }));

export function currencyDigits(code: string): number {
  return (
    FALLBACK_CURRENCY_DEFINITIONS.find((currency) => currency.code === code)
      ?.digits ?? getDigits(code)
  );
}

export function currencyLabel(currency: CurrencyDefinition): string {
  return `${currency.code} — ${currency.name}`;
}

export function formatAmount(amountMinor: number, currency?: string): string {
  if (currency == null) {
    return `${amountMinor.toLocaleString("fr-FR").replace("-", "−")} F`;
  }
  const digits = currencyDigits(currency);
  const amount = amountMinor / 10 ** digits;
  return `${amount
    .toLocaleString("fr-FR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    .replace("-", "−")} ${currency}`;
}

export function parseMoneyInput(value: string, currency: string): number | null {
  const normalized = value
    .trim()
    .replace(/[\s\u00a0]/g, "")
    .replace(",", ".");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.NaN;
  }
  const digits = currencyDigits(currency);
  const factor = 10 ** digits;
  const rounded = Math.round(parsed * factor);
  return Number.isSafeInteger(rounded) ? rounded : Number.NaN;
}

export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** currencyDigits(currency);
}

export function convertMinorAmount(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): number {
  const sourceMajor = minorToMajor(amountMinor, fromCurrency);
  return Math.round(sourceMajor * rate * 10 ** currencyDigits(toCurrency));
}

export function calculateRateFromMinor(
  sourceMinor: number,
  sourceCurrency: string,
  destinationMinor: number,
  destinationCurrency: string,
): number {
  if (sourceMinor <= 0 || destinationMinor < 0) {
    throw new Error("Les montants de conversion sont invalides.");
  }
  return (
    minorToMajor(destinationMinor, destinationCurrency) /
    minorToMajor(sourceMinor, sourceCurrency)
  );
}
