const MAX_SAMPLES_PER_LABEL = 50;
const samples = new Map<string, number[]>();

export interface PerformanceSummary {
  label: string;
  count: number;
  p50Ms: number;
  p95Ms: number;
}

export function isPerformanceProfilingEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PERF_PROFILE === "1";
}

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function record(label: string, durationMs: number): void {
  const values = samples.get(label) ?? [];
  values.push(Math.round(durationMs * 100) / 100);
  if (values.length > MAX_SAMPLES_PER_LABEL) {
    values.splice(0, values.length - MAX_SAMPLES_PER_LABEL);
  }
  samples.set(label, values);
}

export function recordPerformanceSample(label: string, durationMs: number): void {
  if (!isPerformanceProfilingEnabled() || !Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }
  record(label, durationMs);
}

export async function measureAsync<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!isPerformanceProfilingEnabled()) {
    return operation();
  }

  const startedAt = now();
  try {
    return await operation();
  } finally {
    record(label, now() - startedAt);
  }
}

export function getPerformanceSummary(): PerformanceSummary[] {
  return [...samples.entries()]
    .map(([label, values]) => ({
      label,
      count: values.length,
      p50Ms: percentile(values, 0.5),
      p95Ms: percentile(values, 0.95),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function clearPerformanceSamples(): void {
  samples.clear();
}
