import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { Eye, EyeOff, Plus, X } from "lucide-react-native";
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
  const [showHidden, setShowHidden] = useState(false);
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
              {showForm ? (
                <X size={22} strokeWidth={2.2} color={theme.accent} />
              ) : (
                <Plus size={22} strokeWidth={2.2} color={theme.accent} />
              )}
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
      renderItem={({ item }) => {
        const hidden = item.hidden && !showHidden;
        if (hidden) {
          return null;
        }
        return (
          <Pressable
            onPress={() => router.push({ pathname: "/accounts/[id]", params: { id: String(item.id) } })}
            style={({ pressed }) => [
              styles.row,
              item.hidden && { opacity: 0.45 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: theme.label }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.hidden ? (
                  <View style={[styles.hiddenBadge, { backgroundColor: theme.surfaceElevated }]}>
                    <Text style={[styles.hiddenBadgeText, { color: theme.secondaryLabel }]}>
                      Masqué
                    </Text>
                  </View>
                ) : null}
              </View>
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
        );
      }}
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
        <View style={{ gap: spacing.lg }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs }}>
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Patrimoine</Text>
            <Text
              selectable
              style={{
                color: theme.label,
                fontSize: 36,
                fontWeight: "800",
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatAmount(
                (accounts ?? [])
                  .filter((a) => !a.excludeFromTotal)
                  .reduce((sum, a) => sum + a.balance, 0),
              )}
            </Text>
            {(accounts ?? []).some((a) => a.excludeFromTotal) ? (
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                {(accounts ?? []).filter((a) => a.excludeFromTotal).length} compte
                {(accounts ?? []).filter((a) => a.excludeFromTotal).length > 1 ? "s" : ""}{" "}
                exclu{(accounts ?? []).filter((a) => a.excludeFromTotal).length > 1 ? "s" : ""}{" "}
                du total
              </Text>
            ) : null}
          </View>
          {(accounts ?? []).some((a) => a.hidden) ? (
            <Pressable
              onPress={() => setShowHidden((v) => !v)}
              style={({ pressed }) => [
                styles.filterButton,
                { backgroundColor: theme.surface, borderColor: theme.separator },
                pressed && { opacity: 0.7 },
              ]}
            >
              {showHidden ? (
                <EyeOff size={16} strokeWidth={2.2} color={theme.secondaryLabel} />
              ) : (
                <Eye size={16} strokeWidth={2.2} color={theme.secondaryLabel} />
              )}
              <Text style={{ color: theme.secondaryLabel, fontWeight: "600", fontSize: 13 }}>
                {showHidden ? "Masquer les comptes masqués" : "Afficher les comptes masqués"}
              </Text>
            </Pressable>
          ) : null}
          {showForm ? (
            <View
              style={{
                marginHorizontal: spacing.lg,
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
          ) : null}
        </View>
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  hiddenBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.md,
  },
  hiddenBadgeText: {
    fontSize: 11,
    fontWeight: "600",
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
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
