import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { X } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { TransactionRow } from "@/components/transaction-row";
import {
  deleteAccount,
  getAccount,
  renameAccount,
  updateAccountFlags,
} from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { listTransactionsByAccount } from "@/db/transactions";
import { radius, spacing, useTheme } from "@/theme";
import type { Account, Transaction } from "@/types";
import { formatAmount } from "@/utils/format";

export default function AccountDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [acc, rows] = await Promise.all([
      getAccount(db, accountId),
      listTransactionsByAccount(db, accountId),
    ]);
    setAccount(acc);
    setTransactions(rows);
    setEditName(acc?.name ?? "");
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveRename = async () => {
    if (!editName.trim()) {
      return;
    }
    try {
      const db = await getDatabase();
      await renameAccount(db, accountId, editName);
      setEditing(false);
      await load();
    } catch (e) {
      Alert.alert(
        "Impossible de renommer",
        e instanceof Error ? e.message : "Une erreur est survenue.",
      );
    }
  };

  const toggleFlag = async (key: "hidden" | "excludeFromTotal", value: boolean) => {
    const db = await getDatabase();
    await updateAccountFlags(db, accountId, { [key]: value });
    await load();
  };

  const confirmDelete = () => {
    if (!account) {
      return;
    }
    Alert.alert(
      `Supprimer « ${account.name} » ?`,
      "Cette action est définitive. Les transactions du compte seront conservées si elles sont supprimées d'abord.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await deleteAccount(db, accountId);
              router.back();
            } catch (e) {
              Alert.alert(
                "Suppression impossible",
                e instanceof Error ? e.message : "Une erreur est survenue.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: account?.name ?? "Compte",
          headerRight: () =>
            account ? (
              <Pressable
                onPress={() => setEditing((v) => !v)}
                hitSlop={8}
                accessibilityLabel="Renommer le compte"
              >
                {editing ? (
                  <X size={20} strokeWidth={2.2} color={theme.accent} />
                ) : (
                  <Text style={{ color: theme.accent, fontWeight: "600" }}>
                    Modifier
                  </Text>
                )}
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
        data={transactions}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            onPress={() =>
              router.push({
                pathname: "/new-transaction",
                params: { id: String(item.id) },
              })
            }
          />
        )}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.separator,
              marginLeft: spacing.lg + 22,
            }}
          />
        )}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                {account?.categoryName ?? ""}
              </Text>
              <Text
                selectable
                style={{
                  color: theme.label,
                  fontSize: 36,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {account ? formatAmount(account.balance) : "…"}
              </Text>
            </View>
            {editing ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nom du compte"
                  placeholderTextColor={theme.secondaryLabel}
                  style={[
                    styles.input,
                    { backgroundColor: theme.surface, color: theme.label, flex: 1 },
                  ]}
                  autoFocus
                  onSubmitEditing={saveRename}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={saveRename}
                  style={({ pressed }) => [
                    styles.addButton,
                    { backgroundColor: theme.accent },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>OK</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable onPress={confirmDelete} hitSlop={8} style={{ alignSelf: "flex-start" }}>
              <Text style={{ color: theme.expense, fontWeight: "600" }}>
                Supprimer le compte
              </Text>
            </Pressable>
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.label, fontWeight: "600" }}>Masquer le compte</Text>
                  <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                    Retiré des listes et des sélecteurs de transaction.
                  </Text>
                </View>
                <Switch
                  value={account?.hidden ?? false}
                  onValueChange={(v) => toggleFlag("hidden", v)}
                  trackColor={{ true: theme.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.separator,
                }}
              />
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: theme.label, fontWeight: "600" }}>
                    Exclure du total (patrimoine)
                  </Text>
                  <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                    Ce compte est exclu du patrimoine.
                  </Text>
                </View>
                <Switch
                  value={account?.excludeFromTotal ?? false}
                  onValueChange={(v) => toggleFlag("excludeFromTotal", v)}
                  trackColor={{ true: theme.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl }}>
            <Text style={{ color: theme.secondaryLabel, textAlign: "center" }}>
              Aucune transaction sur ce compte.
            </Text>
          </View>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
  },
  addButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 24,
  },
});
