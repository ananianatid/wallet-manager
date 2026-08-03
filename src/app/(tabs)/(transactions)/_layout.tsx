import { Stack } from "expo-router/stack";
import { useTheme } from "@/theme";

export default function TransactionsLayout() {
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
      <Stack.Screen name="index" options={{ title: "Transactions" }} />
    </Stack>
  );
}
