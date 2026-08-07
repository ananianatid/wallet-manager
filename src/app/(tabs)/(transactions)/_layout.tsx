import { Stack } from "expo-router/stack";
import { CompactStackHeader } from "@/components/compact-stack-header";
import { useTheme } from "@/theme";

export default function TransactionsLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background,
        },
        header: CompactStackHeader,
        headerTitleStyle: { color: theme.label },
        headerShadowVisible: false,
        headerTintColor: theme.accent,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Transactions" }} />
      <Stack.Screen name="search" options={{ title: "Recherche et filtres" }} />
    </Stack>
  );
}
