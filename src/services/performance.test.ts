import { clearPerformanceSamples, getPerformanceSummary, measureAsync } from "./performance";

describe("performance measurements", () => {
  beforeEach(() => {
    clearPerformanceSamples();
    delete process.env.EXPO_PUBLIC_PERF_PROFILE;
  });

  it("does not collect samples unless explicitly enabled", async () => {
    await measureAsync("disabled", async () => "ok");
    expect(getPerformanceSummary()).toEqual([]);
  });

  it("keeps bounded samples and exposes p50 and p95 summaries", async () => {
    process.env.EXPO_PUBLIC_PERF_PROFILE = "1";
    for (let index = 0; index < 55; index += 1) {
      await measureAsync("load", async () => undefined);
    }

    expect(getPerformanceSummary()).toEqual([
      { label: "load", count: 50, p50Ms: 0, p95Ms: 0 },
    ]);
  });
});
