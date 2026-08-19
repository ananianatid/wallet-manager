import { ACCENT_THEME_VALUES, getThemePalette } from "./theme";

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = [0, 2, 4].map((offset) =>
      Number.parseInt(color.slice(1 + offset, 3 + offset), 16) / 255,
    );
    const linear = channels.map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };

  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("accent themes", () => {
  it("accepts midnight as a persisted accent option", () => {
    expect(ACCENT_THEME_VALUES).toContain("midnight");
  });

  it("uses indigo citron as the default accent", () => {
    expect(getThemePalette("light")).toMatchObject({
      accent: "#263A77",
      onAccent: "#FFFFFF",
    });
  });

  it("keeps the blue accent consistent across light and dark schemes", () => {
    expect(getThemePalette("dark", "blue").accent).toBe("#339CFF");
    expect(getThemePalette("light", "blue").accent).toBe("#339CFF");
  });

  it("preserves the existing green values per color scheme", () => {
    expect(getThemePalette("dark", "green")).toMatchObject({
      accent: "#34D399",
      onAccent: "#0A0A0B",
    });
    expect(getThemePalette("light", "green")).toMatchObject({
      accent: "#059669",
      onAccent: "#0A0A0B",
    });
  });

  it("exposes navy as an additional global accent theme", () => {
    expect(getThemePalette("light", "midnight")).toMatchObject({
      accent: "#263A77",
      accentSurface: "#263A77",
      accentSurfaceText: "#FFFFFF",
      background: "#F4F6F1",
      surfaceElevated: "#F8FAF5",
    });
    expect(getThemePalette("dark", "midnight")).toMatchObject({
      accent: "#D8F36A",
      accentSurface: "#202D5A",
      background: "#0A1020",
      surface: "#111A2B",
    });
  });

  it("keeps semantic income and expense colors independent from the accent", () => {
    const blue = getThemePalette("light", "blue");
    const green = getThemePalette("light", "green");
    expect(blue.income).toBe(green.income);
    expect(blue.expense).toBe(green.expense);
  });

  it("provides contrast-safe colored surfaces in every theme combination", () => {
    for (const accentTheme of ["blue", "midnight", "green"] as const) {
      for (const scheme of ["light", "dark"] as const) {
        const palette = getThemePalette(scheme, accentTheme);

        expect(contrastRatio(palette.accentSurfaceText, palette.accentSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.accentSurfaceLabel, palette.accentSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.dangerSurfaceText, palette.dangerSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.dangerSurfaceLabel, palette.dangerSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.accentSurfaceIncome, palette.accentSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.accentSurfaceExpense, palette.accentSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.dangerSurfaceIncome, palette.dangerSurface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.dangerSurfaceExpense, palette.dangerSurface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("uses a surface that follows the selected accent", () => {
    expect(getThemePalette("light", "blue").accentSurface).not.toBe(
      getThemePalette("light", "green").accentSurface,
    );
    expect(getThemePalette("light", "blue").dangerSurface).toBe(
      getThemePalette("light", "green").dangerSurface,
    );
  });
});
