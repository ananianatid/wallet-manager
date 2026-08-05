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
  accent: string;
  onAccent: string;
  warning: string;
  income: string;
  expense: string;
}

export type ThemeMode = "system" | "light" | "dark";

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
    accent: "#34D399",
    onAccent: "#0A0A0B",
    warning: "#F59E0B",
    income: "#4ADE80",
    expense: "#F87171",
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
    accent: "#059669",
    onAccent: "#FFFFFF",
    warning: "#B45309",
    income: "#16A34A",
    expense: "#DC2626",
  },
};

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
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_VALUES: ThemeMode[] = ["system", "light", "dark"];

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let cancelled = false;
    getDatabase()
      .then((db) => getSetting(db, "theme_mode"))
      .then((value) => {
        if (cancelled) {
          return;
        }
        if (MODE_VALUES.includes(value as ThemeMode)) {
          setModeState(value as ThemeMode);
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

  const scheme: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const value = useMemo(
    () => ({ theme: palettes[scheme], scheme, mode, setMode }),
    [scheme, mode],
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
  return scheme === "dark" ? palettes.dark : palettes.light;
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
