/// <reference types="jest" />

import { getTabAnimation } from "@/components/motion";

describe("tab navigation animation", () => {
  it("uses a soft horizontal shift on Android", () => {
    expect(getTabAnimation("android", false)).toBe("shift");
  });

  it("disables movement when reduced motion is enabled", () => {
    expect(getTabAnimation("android", true)).toBe("none");
  });

  it("does not change web or other native navigation", () => {
    expect(getTabAnimation("web", false)).toBe("none");
    expect(getTabAnimation("ios", false)).toBe("none");
  });
});
