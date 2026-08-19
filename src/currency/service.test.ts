import { isValidExchangeRate } from "./service";

describe("exchange rates", () => {
  it("accepts only finite positive rates", () => {
    expect(isValidExchangeRate(1)).toBe(true);
    expect(isValidExchangeRate(0.0016)).toBe(true);
    expect(isValidExchangeRate(0)).toBe(false);
    expect(isValidExchangeRate(-1)).toBe(false);
    expect(isValidExchangeRate(Number.NaN)).toBe(false);
    expect(isValidExchangeRate(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
