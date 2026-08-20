import { Stack } from "expo-router/stack";
import { CompactStackHeader } from "@/components/compact-stack-header";
import { useTheme } from "@/theme";

export default function PlansLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        header: CompactStackHeader,
        headerTitleStyle: { color: theme.label, fontSize: 17, fontWeight: "700" },
        headerShadowVisible: false,
        headerTintColor: theme.accent,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
