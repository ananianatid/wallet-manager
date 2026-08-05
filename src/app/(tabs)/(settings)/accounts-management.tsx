import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { Check, Pencil, Tag } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LegacySectionHeader, LegacyTextRow } from "@/components/legacy-money-manager";
import { ScreenState } from "@/components/ui";
import { assignAccountGroup, listAccountGroups } from "@/db/account-groups";
import {
  listAccounts,
  listDeletedAccounts,
  restoreAccount,
} from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import type { Account } from "@/types";

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : "Une erreur est survenue.";

interface Section {
  title: string;
  data: Account[];
}

export default function AccountsManagementScreen() {
  const theme = useTheme();

  const [assigningAccount, setAssigningAccount] = useState<Account | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [groups, accounts, deletedAccounts] = await Promise.all([
      listAccountGroups(db),
      listAccounts(db),
      listDeletedAccounts(db),
    ]);
    return { groups, accounts, deletedAccounts };
  }, []);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const groups = useMemo(
    () => resource.data?.groups ?? [],
    [resource.data?.groups],
  );
  const accounts = useMemo(
    () => resource.data?.accounts ?? [],
    [resource.data?.accounts],
  );
  const deletedAccounts = useMemo(
    () => resource.data?.deletedAccounts ?? [],
    [resource.data?.deletedAccounts],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const sections = useMemo<Section[]>(() => {
    const result: Section[] = groups.map((group) => ({
      title: group.name,
      data: accounts.filter((account) => account.groupId === group.id),
    }));
    const ungrouped = accounts.filter((account) => account.groupId == null);
    if (ungrouped.length > 0) {
      result.push({ title: "Sans groupe", data: ungrouped });
    }
    return result;
  }, [groups, accounts]);

  const assignOptions = useMemo<{ id: number | null; label: string }[]>(
    () => [
      { id: null, label: "Sans groupe" },
      ...groups.map((group) => ({ id: group.id, label: group.name })),
    ],
    [groups],
  );

  const restore = async (account: Account) => {
    try {
      const db = await getDatabase();
      await restoreAccount(db, account.id);
      await reload();
    } catch (e) {
      Alert.alert("Restauration impossible", errorMessage(e));
    }
  };

  const assignGroup = async (groupId: number | null) => {
    if (!assigningAccount) {
      return;
    }
    try {
      const db = await getDatabase();
      await assignAccountGroup(db, assigningAccount.id, groupId);
      await reload();
    } catch (e) {
      Alert.alert("Impossible d'affecter", errorMessage(e));
    } finally {
      setAssigningAccount(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Gestion des comptes" }} />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={resource.error?.message}
          onRetry={() => void resource.reload()}
        />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={[styles.screen, { backgroundColor: theme.background }]}
          contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
        >
          {sections.map((section) => (
            <View
              key={section.title}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator }]}
            >
              <LegacySectionHeader>{section.title}</LegacySectionHeader>
              <View style={styles.accountList}>
                {section.data.map((account) => (
                  <LegacyTextRow
                    key={account.id}
                    label={account.name}
                    onPress={() =>
                      router.push({
                        pathname: "/accounts/[id]",
                        params: { id: String(account.id) },
                      })
                    }
                    right={
                      <View style={styles.actions}>
                        <Pressable
                          onPress={() => setAssigningAccount(account)}
                          hitSlop={8}
                          accessibilityLabel={`Changer le groupe de ${account.name}`}
                        >
                          <Tag size={20} color={theme.secondaryLabel} strokeWidth={2} />
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/accounts/[id]/edit",
                              params: { id: String(account.id) },
                            })
                          }
                          hitSlop={8}
                          accessibilityLabel={`Modifier ${account.name}`}
                        >
                          <Pencil size={20} color={theme.secondaryLabel} strokeWidth={2} />
                        </Pressable>
                      </View>
                    }
                  />
                ))}
              </View>
            </View>
          ))}

          {deletedAccounts.length > 0 ? (
            <View
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.separator, opacity: 0.6 }]}
            >
              <LegacySectionHeader>Comptes supprimés</LegacySectionHeader>
              <View style={styles.accountList}>
                {deletedAccounts.map((account) => (
                  <LegacyTextRow
                    key={account.id}
                    label={account.name}
                    right={
                      <Pressable
                        onPress={() => restore(account)}
                        hitSlop={8}
                        accessibilityLabel={`Restaurer ${account.name}`}
                      >
                        <Text style={{ color: theme.accent, fontSize: 14, fontWeight: "600" }}>
                          Restaurer
                        </Text>
                      </Pressable>
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={assigningAccount != null}
        transparent
        animationType="fade"
        onRequestClose={() => setAssigningAccount(null)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setAssigningAccount(null)}
          accessibilityLabel="Fermer"
        >
          <Pressable style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.sheetTitle, { color: theme.label }]}>
              {assigningAccount?.name}
            </Text>
            <FlatList
              data={assignOptions}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => {
                const selected = (assigningAccount?.groupId ?? null) === item.id;
                return (
                  <Pressable
                    onPress={() => assignGroup(item.id)}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.option,
                      { backgroundColor: pressed ? theme.surface : "transparent" },
                    ]}
                  >
                    <Text style={{ color: theme.label, flex: 1 }} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {selected ? (
                      <Check size={18} strokeWidth={2.4} color={theme.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.lg },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  accountList: { overflow: "hidden" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  sheetTitle: {
    fontWeight: "700",
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
