export function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR").replace("-", "−")} F`;
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
