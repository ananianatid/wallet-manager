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

const startOfLocalDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function formatDayLabel(ms: number, now: Date = new Date()): string {
  const day = startOfLocalDay(new Date(ms));
  const today = startOfLocalDay(now);
  if (day === today) {
    return "Aujourd'hui";
  }
  if (day === today - 86_400_000) {
    return "Hier";
  }
  return formatDate(ms);
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
