export function calculateTransferFee(
  debitedAmount: number,
  arrivedAmount: number,
): number {
  if (!Number.isInteger(debitedAmount) || debitedAmount <= 0) {
    throw new Error("Le montant débité doit être un entier strictement positif.");
  }
  if (!Number.isInteger(arrivedAmount) || arrivedAmount <= 0) {
    throw new Error("Le montant arrivé doit être un entier strictement positif.");
  }
  if (debitedAmount < arrivedAmount) {
    throw new Error(
      "Le montant débité doit être supérieur ou égal au montant arrivé.",
    );
  }

  return debitedAmount - arrivedAmount;
}
