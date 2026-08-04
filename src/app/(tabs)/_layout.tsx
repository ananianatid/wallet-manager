import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/theme";

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <NativeTabs
      tintColor={theme.accent}
      backgroundColor={theme.background}
      iconColor={{ default: theme.secondaryLabel, selected: theme.accent }}
      labelStyle={{
        default: { color: theme.secondaryLabel, fontWeight: "600" },
        selected: { color: theme.accent, fontWeight: "700" },
      }}
      labelVisibilityMode="labeled"
      indicatorColor={`${theme.accent}33`}
      rippleColor={`${theme.accent}1F`}
    >
      <NativeTabs.Trigger name="(transactions)">
        <NativeTabs.Trigger.Icon sf="list.dash" md="receipt_long" />
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(statistics)">
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
        <NativeTabs.Trigger.Label>Statistiques</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(accounts)">
        <NativeTabs.Trigger.Icon sf="creditcard" md="account_balance_wallet" />
        <NativeTabs.Trigger.Label>Comptes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        <NativeTabs.Trigger.Label>Paramètres</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
