import {
  calculateRateFromMinor,
  convertMinorAmount,
  formatAmount,
  parseMoneyInput,
} from "./currencies";

describe("currency amounts", () => {
  it("parses minor units according to the currency precision", () => {
    expect(parseMoneyInput("12,50", "USD")).toBe(1250);
    expect(parseMoneyInput("12 500", "XOF")).toBe(12500);
  });

  it("converts between currencies while preserving integer minor units", () => {
    expect(convertMinorAmount(10_000, "XOF", "USD", 0.0016)).toBe(1600);
    expect(calculateRateFromMinor(10_000, "XOF", 1600, "USD")).toBeCloseTo(0.0016);
  });

  it("always includes the ISO code when a currency is provided", () => {
    expect(formatAmount(1250, "USD")).toBe("12,50 USD");
    expect(formatAmount(12500, "XOF")).toBe("12 500 XOF");
  });
});
