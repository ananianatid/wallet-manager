import { useColorScheme } from "react-native";

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  label: string;
  secondaryLabel: string;
  separator: string;
  accent: string;
  income: string;
  expense: string;
}

export const palettes: Record<"dark" | "light", ThemeColors> = {
  dark: {
    background: "#0A0A0B",
    surface: "#141417",
    surfaceElevated: "#1D1D22",
    label: "#F5F5F7",
    secondaryLabel: "#9B9BA3",
    separator: "#2A2A2E",
    accent: "#34D399",
    income: "#4ADE80",
    expense: "#F87171",
  },
  light: {
    background: "#FFFFFF",
    surface: "#F5F5F7",
    surfaceElevated: "#FFFFFF",
    label: "#1C1C1E",
    secondaryLabel: "#6E6E73",
    separator: "#E5E5EA",
    accent: "#059669",
    income: "#16A34A",
    expense: "#DC2626",
  },
};

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? palettes.dark : palettes.light;
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
