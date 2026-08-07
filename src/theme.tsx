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
    background: "#0A0A0B",
    surface: "#141417",
    surfaceMuted: "#101013",
    surfaceElevated: "#1D1D22",
    label: "#F5F5F7",
    secondaryLabel: "#9B9BA3",
    separator: "#2A2A2E",
    outline: "#4A4A52",
    scrim: "#00000080",
    accent: "#34D399",
    onAccent: "#0A0A0B",
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
    background: "#FFFFFF",
    surface: "#F5F5F7",
    surfaceMuted: "#FAFAFB",
    surfaceElevated: "#FFFFFF",
    label: "#1C1C1E",
    secondaryLabel: "#6E6E73",
    separator: "#E5E5EA",
    outline: "#B8B8C0",
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
      accent: "#7CC2FF",
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
      accent: "#123A60",
      onAccent: "#FFFFFF",
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
    background: "#07111F",
    surface: "#0C1C2B",
    surfaceMuted: "#091622",
    surfaceElevated: "#10283D",
    label: "#F2F8FF",
    secondaryLabel: "#9FB6CC",
    separator: "#1D3952",
    outline: "#3D607C",
  },
  light: {
    background: "#F3F7FC",
    surface: "#FFFFFF",
    surfaceMuted: "#F8FBFF",
    surfaceElevated: "#EAF3FC",
    label: "#102B45",
    secondaryLabel: "#55708B",
    separator: "#D7E6F5",
    outline: "#9DB8D0",
  },
};

export function getThemePalette(
  scheme: "dark" | "light",
  accentTheme: AccentTheme = "blue",
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
  const [accentTheme, setAccentThemeState] = useState<AccentTheme>("blue");

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
  md: 12,
  lg: 16,
  xl: 24,
} as const;
