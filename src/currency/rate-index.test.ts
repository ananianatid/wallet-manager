import type { CurrencyRate } from "./service";
import { convertWithIndexedRates, indexCurrencyRates } from "./rate-index";

const rates: CurrencyRate[] = [
  {
    base: "XOF",
    quote: "USD",
    rate: 0.0016,
    provider: "test",
    date: "2026-08-19",
    fetchedAt: 1,
  },
  {
    base: "XOF",
    quote: "EUR",
    rate: 0.0015,
    provider: "test",
    date: "2026-08-19",
    fetchedAt: 1,
  },
];

describe("indexed currency rates", () => {
  const indexed = indexCurrencyRates(rates);

  it("uses a direct rate without scanning the rate list", () => {
    expect(convertWithIndexedRates(10_000, "XOF", "USD", indexed)).toBe(1600);
  });

  it("converts through a shared base currency", () => {
    expect(convertWithIndexedRates(10_000, "USD", "EUR", indexed)).toBe(9375);
  });

  it("returns null when currencies have no compatible rate", () => {
    expect(convertWithIndexedRates(10_000, "GBP", "EUR", indexed)).toBeNull();
  });
});
