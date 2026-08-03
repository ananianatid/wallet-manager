import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/theme";

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <NativeTabs tintColor={theme.accent}>
      <NativeTabs.Trigger name="(transactions)">
        <NativeTabs.Trigger.Icon sf="list.dash" md="receipt_long" />
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(accounts)">
        <NativeTabs.Trigger.Icon sf="creditcard" md="account_balance_wallet" />
        <NativeTabs.Trigger.Label>Comptes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(categories)">
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="category" />
        <NativeTabs.Trigger.Label>Catégories</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
