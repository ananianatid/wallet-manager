import { initialRouteForStartup } from "../bootstrap";

describe("initialRouteForStartup", () => {
  it("prioritizes onboarding before cloud welcome", () => {
    expect(
      initialRouteForStartup({ needsOnboarding: true, needsCloudWelcome: true }),
    ).toBe("onboarding");
  });

  it("shows cloud welcome after onboarding", () => {
    expect(
      initialRouteForStartup({ needsOnboarding: false, needsCloudWelcome: true }),
    ).toBe("cloud-welcome");
  });

  it("opens the local shell when startup is complete", () => {
    expect(
      initialRouteForStartup({ needsOnboarding: false, needsCloudWelcome: false }),
    ).toBe("(tabs)");
  });
});
