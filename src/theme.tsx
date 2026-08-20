import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useColorScheme } from "react-native";
import { getDatabase } from "@/db/database";
import { getSetting, setSetting } from "@/db/settings";

/*
THESIS: Wallet is a calm personal finance OS that makes the next useful decision obvious.
OWN-WORLD: Warm paper background, deep botanical green, quiet separators, soft semantic colors, and one restrained focal card.
STORY: Understand where the money stands, see what changed, then record or prepare the next move.
FIRST VIEWPORT: A quiet greeting, the available-money card, recent activity, and one central add action.
FORM: Five Android destinations keep daily activity, planning, analysis, and accounts discoverable without dashboard noise.
*/

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  label: string;
  muted: string;
  secondaryLabel: string;
  separator: string;
  outline: string;
  scrim: string;
  accent: string;
  onAccent: string;
  warning: string;
  income: string;
  expense: string;
  accentSurface: string;
  accentSurfaceLabel: string;
  accentSurfaceText: string;
  dangerSurface: string;
  dangerSurfaceLabel: string;
  dangerSurfaceText: string;
  accentSurfaceIncome: string;
  accentSurfaceExpense: string;
  dangerSurfaceIncome: string;
  dangerSurfaceExpense: string;
}

export type ThemeMode = "system" | "light" | "dark";
// Kept for backwards compatibility with persisted settings. The visual identity is fixed.
export type AccentTheme = "blue" | "midnight" | "green";

export const palettes: Record<"dark" | "light", ThemeColors> = {
  dark: {
    background: "#101713",
    surface: "#17201A",
    surfaceMuted: "#131B16",
    surfaceElevated: "#202B24",
    label: "#F2F5F0",
    muted: "#B1BAB1",
    secondaryLabel: "#B1BAB1",
    separator: "#303B33",
    outline: "#657268",
    scrim: "#00000080",
    accent: "#B0D2B8",
    onAccent: "#17231B",
    warning: "#D7A65D",
    income: "#8DBA96",
    expense: "#E28A80",
    accentSurface: "#26352D",
    accentSurfaceLabel: "#DCE8DE",
    accentSurfaceText: "#FFFFFF",
    dangerSurface: "#5B2B27",
    dangerSurfaceLabel: "#F6CCC7",
    dangerSurfaceText: "#FFFFFF",
    accentSurfaceIncome: "#B9D9C0",
    accentSurfaceExpense: "#F0AAA2",
    dangerSurfaceIncome: "#B9D9C0",
    dangerSurfaceExpense: "#F0AAA2",
  },
  light: {
    background: "#F5F5F2",
    surface: "#FFFFFF",
    surfaceMuted: "#F0F1EC",
    surfaceElevated: "#FAFAF7",
    label: "#181916",
    muted: "#85877F",
    secondaryLabel: "#6B7068",
    separator: "#E6E6E0",
    outline: "#A3A59D",
    scrim: "#00000080",
    accent: "#26352D",
    onAccent: "#FFFFFF",
    warning: "#906622",
    income: "#4C6656",
    expense: "#B75C52",
    accentSurface: "#26352D",
    accentSurfaceLabel: "#DCE8DE",
    accentSurfaceText: "#FFFFFF",
    dangerSurface: "#F4DFDC",
    dangerSurfaceLabel: "#7C352E",
    dangerSurfaceText: "#5B2924",
    accentSurfaceIncome: "#B9D9C0",
    accentSurfaceExpense: "#F0AAA2",
    dangerSurfaceIncome: "#4C6656",
    dangerSurfaceExpense: "#B75C52",
  },
};

// Old values remain accepted when reading existing settings, but no longer change the product palette.
export const ACCENT_THEME_VALUES: AccentTheme[] = ["blue", "midnight", "green"];

export function getThemePalette(
  scheme: "dark" | "light",
  _accentTheme: AccentTheme = "midnight",
): ThemeColors {
  return palettes[scheme];
}

export function withAlpha(color: string, alpha: string): string {
  return `${color}${alpha}`;
}

export const chartColors = [
  "#4C6656",
  "#789681",
  "#B7A26A",
  "#8F9FB0",
  "#A8879A",
  "#6E9B9A",
  "#B75C52",
  "#9AAE75",
  "#C48668",
  "#7B82A7",
];

interface ThemeContextValue {
  theme: ThemeColors;
  scheme: "light" | "dark";
  mode: ThemeMode;
  accentTheme: AccentTheme;
  setMode: (mode: ThemeMode) => void;
  setAccentTheme: (accentTheme: AccentTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const MODE_VALUES: ThemeMode[] = ["system", "light", "dark"];

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [accentTheme, setAccentThemeState] = useState<AccentTheme>("midnight");

  useEffect(() => {
    let cancelled = false;
    getDatabase().then(async (db) => {
      const [modeValue, accentThemeValue] = await Promise.all([
        getSetting(db, "theme_mode"),
        getSetting(db, "accent_theme"),
      ]);
      if (cancelled) {
        return;
      }
      if (MODE_VALUES.includes(modeValue as ThemeMode)) {
        setModeState(modeValue as ThemeMode);
      }
      if (ACCENT_THEME_VALUES.includes(accentThemeValue as AccentTheme)) {
        setAccentThemeState(accentThemeValue as AccentTheme);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    getDatabase().then((db) => setSetting(db, "theme_mode", next)).catch(() => {});
  };

  const setAccentTheme = (next: AccentTheme) => {
    setAccentThemeState(next);
    getDatabase().then((db) => setSetting(db, "accent_theme", next)).catch(() => {});
  };

  const scheme: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const theme = useMemo(() => getThemePalette(scheme, accentTheme), [accentTheme, scheme]);
  const value = useMemo(
    () => ({ theme, scheme, mode, accentTheme, setMode, setAccentTheme }),
    [accentTheme, mode, scheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeColors {
  const ctx = useContext(ThemeContext);
  const scheme = useColorScheme();
  if (ctx) {
    return ctx.theme;
  }
  return getThemePalette(scheme === "dark" ? "dark" : "light");
}

export function useThemeControl(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeControl must be used inside ThemeProvider");
  }
  return ctx;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 12,
  md: 12,
  lg: 18,
  xl: 26,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 38, fontWeight: "700" as const, letterSpacing: -1.35 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: "700" as const, letterSpacing: -0.5 },
  section: { fontSize: 18, lineHeight: 23, fontWeight: "700" as const, letterSpacing: -0.25 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const, letterSpacing: 0.1 },
  amount: { fontSize: 46, lineHeight: 50, fontWeight: "700" as const, letterSpacing: -2.3 },
} as const;
