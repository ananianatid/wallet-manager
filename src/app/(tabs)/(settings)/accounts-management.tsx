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
import { EmptyState } from "@/components/empty-state";
import { assignLocalAccountGroup, loadAccountsManagement, restoreLocalAccount } from "@/data/account-groups";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import type { Account } from "@/types";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

interface Section {
  title: string;
  data: Account[];
}

export default function AccountsManagementScreen() {
  const theme = useTheme();

  const [assigningAccount, setAssigningAccount] = useState<Account | null>(null);

  const load = useCallback(async () => {
    return loadAccountsManagement();
  }, []);

  const resource = useAsyncResource(load, "accounts.management");
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
      await restoreLocalAccount(account.id);
      await reload();
    } catch (e) {
      log.error("accounts.restore", "Échec de la restauration du compte", e);
      Alert.alert("Restauration impossible", userMessage(e));
    }
  };

  const assignGroup = async (groupId: number | null) => {
    if (!assigningAccount) {
      return;
    }
    try {
      await assignLocalAccountGroup(assigningAccount.id, groupId);
      await reload();
    } catch (e) {
      log.error("accounts.assign-group", "Échec de l'affectation du groupe", e);
      Alert.alert("Impossible d'affecter", userMessage(e));
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
          message={userMessage(resource.error)}
          onRetry={() => void resource.reload()}
        />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={[styles.screen, { backgroundColor: theme.background }]}
          contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
        >
          {accounts.length === 0 && deletedAccounts.length === 0 ? (
            <EmptyState
              title="Aucun compte"
              message="Créez un compte pour le gérer ici."
            />
          ) : null}
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
                          style={styles.actionTouchTarget}
                          accessibilityRole="button"
                          accessibilityLabel={`Changer le groupe de ${account.name}`}
                          accessibilityHint="Choisir un autre groupe"
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
                            style={styles.actionTouchTarget}
                            accessibilityRole="button"
                            accessibilityLabel={`Modifier ${account.name}`}
                            accessibilityHint="Modifier les informations du compte"
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
                        style={styles.restoreTouchTarget}
                        accessibilityRole="button"
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
        animationType="slide"
        onRequestClose={() => setAssigningAccount(null)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.scrim }]}
          onPress={() => setAssigningAccount(null)}
          accessibilityLabel="Fermer"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}
          >
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
  actionTouchTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreTouchTarget: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  backdrop: {
    flex: 1,
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
