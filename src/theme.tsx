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
THESIS: Wallet is a pocket cash desk: decide what is safe now, record it fast, then prepare what comes next.
OWN-WORLD: Indigo ledger surfaces, lime decision markers, coral outflows, mint inflows, compact Android type.
STORY: See the available amount, record a movement, then find every future commitment in Plans.
FIRST VIEWPORT: A calm daily header, the available-now decision card, then three quick actions.
FORM: Five Android destinations split daily operation from planning and configuration; lists stay dense, calm, and actionable.
*/

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  label: string;
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
export type AccentTheme = "blue" | "midnight" | "green";

export const palettes: Record<"dark" | "light", ThemeColors> = {
  dark: {
    background: "#0A1020",
    surface: "#111A2B",
    surfaceMuted: "#0E1728",
    surfaceElevated: "#182541",
    label: "#F3F6FF",
    secondaryLabel: "#9EAAC4",
    separator: "#263452",
    outline: "#516181",
    scrim: "#00000080",
    accent: "#34D399",
    onAccent: "#0A1020",
    warning: "#F59E0B",
    income: "#4ADE80",
    expense: "#F87171",
    accentSurface: "#0F3D2E",
    accentSurfaceLabel: "#B8F0D8",
    accentSurfaceText: "#FFFFFF",
    dangerSurface: "#5A232B",
    dangerSurfaceLabel: "#FFD0D6",
    dangerSurfaceText: "#FFFFFF",
    accentSurfaceIncome: "#86EFAC",
    accentSurfaceExpense: "#FFB0B0",
    dangerSurfaceIncome: "#86EFAC",
    dangerSurfaceExpense: "#FFB0B0",
  },
  light: {
    background: "#F4F6F1",
    surface: "#FFFFFF",
    surfaceMuted: "#EDF1EA",
    surfaceElevated: "#F8FAF5",
    label: "#16213A",
    secondaryLabel: "#5F6D83",
    separator: "#D9E1D6",
    outline: "#99A8A0",
    scrim: "#00000080",
    accent: "#059669",
    onAccent: "#FFFFFF",
    warning: "#B45309",
    income: "#16A34A",
    expense: "#DC2626",
    accentSurface: "#0F3D2E",
    accentSurfaceLabel: "#B8F0D8",
    accentSurfaceText: "#FFFFFF",
    dangerSurface: "#5A232B",
    dangerSurfaceLabel: "#FFD0D6",
    dangerSurfaceText: "#FFFFFF",
    accentSurfaceIncome: "#86EFAC",
    accentSurfaceExpense: "#FFB0B0",
    dangerSurfaceIncome: "#86EFAC",
    dangerSurfaceExpense: "#FFB0B0",
  },
};

export const ACCENT_THEME_VALUES: AccentTheme[] = ["blue", "midnight", "green"];

const ACCENT_PALETTES: Record<
  AccentTheme,
  Record<
    "dark" | "light",
    Pick<
      ThemeColors,
      | "accent"
      | "onAccent"
      | "accentSurface"
      | "accentSurfaceLabel"
      | "accentSurfaceText"
      | "dangerSurface"
      | "dangerSurfaceLabel"
      | "dangerSurfaceText"
      | "accentSurfaceIncome"
      | "accentSurfaceExpense"
      | "dangerSurfaceIncome"
      | "dangerSurfaceExpense"
    >
  >
> = {
  blue: {
    dark: {
      accent: "#339CFF",
      onAccent: "#07111F",
      accentSurface: "#123A60",
      accentSurfaceLabel: "#B7DBFF",
      accentSurfaceText: "#FFFFFF",
      dangerSurface: "#5A232B",
      dangerSurfaceLabel: "#FFD0D6",
      dangerSurfaceText: "#FFFFFF",
      accentSurfaceIncome: "#86EFAC",
      accentSurfaceExpense: "#FFB0B0",
      dangerSurfaceIncome: "#86EFAC",
      dangerSurfaceExpense: "#FFB0B0",
    },
    light: {
      accent: "#339CFF",
      onAccent: "#07111F",
      accentSurface: "#123A60",
      accentSurfaceLabel: "#B7DBFF",
      accentSurfaceText: "#FFFFFF",
      dangerSurface: "#5A232B",
      dangerSurfaceLabel: "#FFD0D6",
      dangerSurfaceText: "#FFFFFF",
      accentSurfaceIncome: "#86EFAC",
      accentSurfaceExpense: "#FFB0B0",
      dangerSurfaceIncome: "#86EFAC",
      dangerSurfaceExpense: "#FFB0B0",
    },
  },
  midnight: {
    dark: {
      accent: "#D8F36A",
      onAccent: "#17213A",
      accentSurface: "#202D5A",
      accentSurfaceLabel: "#E6EDB2",
      accentSurfaceText: "#FFFFFF",
      dangerSurface: "#5A232B",
      dangerSurfaceLabel: "#FFD0D6",
      dangerSurfaceText: "#FFFFFF",
      accentSurfaceIncome: "#86EFAC",
      accentSurfaceExpense: "#FFB0B0",
      dangerSurfaceIncome: "#86EFAC",
      dangerSurfaceExpense: "#FFB0B0",
    },
    light: {
      accent: "#263A77",
      onAccent: "#FFFFFF",
      accentSurface: "#263A77",
      accentSurfaceLabel: "#D7E0FF",
      accentSurfaceText: "#FFFFFF",
      dangerSurface: "#5A232B",
      dangerSurfaceLabel: "#FFD0D6",
      dangerSurfaceText: "#FFFFFF",
      accentSurfaceIncome: "#86EFAC",
      accentSurfaceExpense: "#FFB0B0",
      dangerSurfaceIncome: "#86EFAC",
      dangerSurfaceExpense: "#FFB0B0",
    },
  },
  green: {
    dark: {
      accent: "#34D399",
      onAccent: "#0A0A0B",
      accentSurface: "#0F3D2E",
      accentSurfaceLabel: "#B8F0D8",
      accentSurfaceText: "#FFFFFF",
      dangerSurface: "#5A232B",
      dangerSurfaceLabel: "#FFD0D6",
      dangerSurfaceText: "#FFFFFF",
      accentSurfaceIncome: "#86EFAC",
      accentSurfaceExpense: "#FFB0B0",
      dangerSurfaceIncome: "#86EFAC",
      dangerSurfaceExpense: "#FFB0B0",
    },
    light: {
      accent: "#059669",
      onAccent: "#0A0A0B",
      accentSurface: "#0F3D2E",
      accentSurfaceLabel: "#B8F0D8",
      accentSurfaceText: "#FFFFFF",
      dangerSurface: "#5A232B",
      dangerSurfaceLabel: "#FFD0D6",
      dangerSurfaceText: "#FFFFFF",
      accentSurfaceIncome: "#86EFAC",
      accentSurfaceExpense: "#FFB0B0",
      dangerSurfaceIncome: "#86EFAC",
      dangerSurfaceExpense: "#FFB0B0",
    },
  },
};

type MidnightNeutralPalette = Pick<
  ThemeColors,
  | "background"
  | "surface"
  | "surfaceMuted"
  | "surfaceElevated"
  | "label"
  | "secondaryLabel"
  | "separator"
  | "outline"
>;

const MIDNIGHT_NEUTRALS: Record<"dark" | "light", MidnightNeutralPalette> = {
  dark: {
    background: "#0A1020",
    surface: "#111A2B",
    surfaceMuted: "#0E1728",
    surfaceElevated: "#182541",
    label: "#F3F6FF",
    secondaryLabel: "#9EAAC4",
    separator: "#263452",
    outline: "#516181",
  },
  light: {
    background: "#F4F6F1",
    surface: "#FFFFFF",
    surfaceMuted: "#EDF1EA",
    surfaceElevated: "#F8FAF5",
    label: "#16213A",
    secondaryLabel: "#5F6D83",
    separator: "#D9E1D6",
    outline: "#99A8A0",
  },
};

export function getThemePalette(
  scheme: "dark" | "light",
  accentTheme: AccentTheme = "midnight",
): ThemeColors {
  return {
    ...palettes[scheme],
    ...ACCENT_PALETTES[accentTheme][scheme],
    ...(accentTheme === "midnight" ? MIDNIGHT_NEUTRALS[scheme] : {}),
  };
}

export function withAlpha(color: string, alpha: string): string {
  return `${color}${alpha}`;
}

export const chartColors = [
  "#34D399",
  "#60A5FA",
  "#F59E0B",
  "#A78BFA",
  "#F472B6",
  "#22D3EE",
  "#F87171",
  "#A3E635",
  "#FBBF24",
  "#818CF8",
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
  const [mode, setModeState] = useState<ThemeMode>("system");
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
    })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    getDatabase()
      .then((db) => setSetting(db, "theme_mode", next))
      .catch(() => {});
  };

  const setAccentTheme = (next: AccentTheme) => {
    setAccentThemeState(next);
    getDatabase()
      .then((db) => setSetting(db, "accent_theme", next))
      .catch(() => {});
  };

  const scheme: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const theme = useMemo(
    () => getThemePalette(scheme, accentTheme),
    [accentTheme, scheme],
  );

  const value = useMemo(
    () => ({ theme, scheme, mode, accentTheme, setMode, setAccentTheme }),
    [accentTheme, mode, scheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "800" as const, letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const, letterSpacing: -0.35 },
  section: { fontSize: 16, lineHeight: 22, fontWeight: "700" as const, letterSpacing: -0.15 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const, letterSpacing: 0.15 },
  amount: { fontSize: 30, lineHeight: 36, fontWeight: "800" as const },
} as const;
