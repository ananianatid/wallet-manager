import { ACCENT_THEME_VALUES, getThemePalette } from "./theme";

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = [0, 2, 4].map((offset) => Number.parseInt(color.slice(1 + offset, 3 + offset), 16) / 255);
    const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Finance Personal OS theme", () => {
  it("keeps persisted accent values readable without changing the fixed identity", () => {
    expect(ACCENT_THEME_VALUES).toEqual(["blue", "midnight", "green"]);
    expect(getThemePalette("light", "blue")).toEqual(getThemePalette("light", "green"));
  });

  it("uses the warm paper and botanical green palette", () => {
    expect(getThemePalette("light")).toMatchObject({
      background: "#F5F5F2",
      surface: "#FFFFFF",
      label: "#181916",
      muted: "#85877F",
      separator: "#E6E6E0",
      accent: "#26352D",
      income: "#4C6656",
      expense: "#B75C52",
      accentSurface: "#26352D",
    });
  });

  it("derives a distinct accessible dark palette", () => {
    expect(getThemePalette("dark").background).toBe("#101713");
    expect(getThemePalette("dark").accent).toBe("#B0D2B8");
    expect(getThemePalette("dark").background).not.toBe(getThemePalette("light").background);
  });

  it("keeps semantic text readable on main surfaces", () => {
    for (const scheme of ["light", "dark"] as const) {
      const palette = getThemePalette(scheme);
      expect(contrastRatio(palette.label, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.secondaryLabel, palette.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.accentSurfaceText, palette.accentSurface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.accentSurfaceLabel, palette.accentSurface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.dangerSurfaceLabel, palette.dangerSurface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
