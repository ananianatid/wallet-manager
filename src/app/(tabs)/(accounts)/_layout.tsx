import { Stack } from "expo-router/stack";
import { useTheme } from "@/theme";

export default function AccountsLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { color: theme.label },
        headerShadowVisible: false,
        headerTintColor: theme.accent,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Comptes" }} />
    </Stack>
  );
}
