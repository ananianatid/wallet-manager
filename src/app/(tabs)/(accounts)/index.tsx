import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EmptyState } from "@/components/empty-state";
import { SelectField } from "@/components/select-field";
import { listAccounts, createAccount } from "@/db/accounts";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { radius, spacing, useTheme } from "@/theme";
import type { Account, Category } from "@/types";
import { formatAmount } from "@/utils/format";

export default function AccountsScreen() {
  const theme = useTheme();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountCategories, setAccountCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [accs, cats] = await Promise.all([
      listAccounts(db),
      listCategories(db, "account"),
    ]);
    setAccounts(accs);
    setAccountCategories(cats);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const submit = async () => {
    if (!name.trim()) {
      return;
    }
    const db = await getDatabase();
    await createAccount(db, { name, categoryId: categoryId ?? accountCategories[0]?.id ?? 0 });
    setName("");
    setCategoryId(null);
    setShowForm(false);
    await load();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => setShowForm((v) => !v)}
              hitSlop={8}
              accessibilityLabel="Ajouter un compte"
            >
              <Text style={{ color: theme.accent, fontSize: 24, fontWeight: "600" }}>
                {showForm ? "✕" : "+"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
      data={accounts ?? []}
      keyExtractor={(a) => String(a.id)}
      renderItem={({ item }) => (        <Pressable
          onPress={() => router.push({ pathname: "/accounts/[id]", params: { id: String(item.id) } })}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
        >
          <View style={[styles.dot, { backgroundColor: theme.accent }]} />
          <View style={styles.body}>
            <Text style={[styles.name, { color: theme.label }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.category, { color: theme.secondaryLabel }]}>
              {item.categoryName}
            </Text>
          </View>
          <Text
            selectable
            style={[
              styles.balance,
              { color: item.balance >= 0 ? theme.label : theme.expense },
            ]}
          >
            {formatAmount(item.balance)}
          </Text>
        </Pressable>
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
        showForm ? (
          <View
            style={{
              margin: spacing.lg,
              padding: spacing.lg,
              gap: spacing.md,
              backgroundColor: theme.surface,
              borderRadius: radius.lg,
            }}
          >
            <Text style={[styles.name, { color: theme.label }]}>Nouveau compte</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nom du compte"
              placeholderTextColor={theme.secondaryLabel}
              style={{
                color: theme.label,
                backgroundColor: theme.surfaceElevated,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                borderRadius: radius.md,
              }}
              autoFocus
            />
            <SelectField
              label="Type de compte"
              value={
                accountCategories.find((c) => c.id === categoryId)?.name ?? null
              }
              options={accountCategories.map((c) => ({ id: c.id, label: c.name }))}
              onChange={setCategoryId}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowForm(false)}
                style={({ pressed }) => [styles.button, { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ color: theme.secondaryLabel, fontWeight: "600" }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, flex: 1 }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>Créer</Text>
              </Pressable>
            </View>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          title="Aucun compte"
          message="Créez votre premier compte pour commencer à suivre vos transactions."
          actionLabel="Créer un compte"
          onAction={() => setShowForm(true)}
        />
      }
    />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontWeight: "600",
  },
  category: {
    fontSize: 13,
  },
  balance: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
    alignItems: "center",
  },
});
