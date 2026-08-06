import { calculateTransferFee } from "./transfer-fees";

describe("calculateTransferFee", () => {
  it("calcule la différence entre le débit et le montant arrivé", () => {
    expect(calculateTransferFee(12_000, 11_750)).toBe(250);
  });

  it("retourne zéro quand le transfert est sans frais", () => {
    expect(calculateTransferFee(12_000, 12_000)).toBe(0);
  });

  it("refuse un débit inférieur au montant arrivé", () => {
    expect(() => calculateTransferFee(11_000, 12_000)).toThrow(
      "supérieur ou égal",
    );
  });

  it.each([
    [0, 12_000],
    [-1, 12_000],
    [12_000, 0],
    [12_000, -1],
    [12_000.5, 12_000],
  ])("refuse les montants invalides: %p / %p", (debited, arrived) => {
    expect(() => calculateTransferFee(debited, arrived)).toThrow();
  });
});
