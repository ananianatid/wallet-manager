import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { Eye, EyeOff, Plus, Target, X } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EmptyState } from "@/components/empty-state";
import { SelectField } from "@/components/select-field";
import { IconButton, InlineError, ScreenState } from "@/components/ui";
import { listAccountGroups } from "@/db/account-groups";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccountFlags,
} from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import type { Account } from "@/types";
import { formatAmount } from "@/utils/format";

export default function AccountsScreen() {
  const theme = useTheme();
  const [formError, setFormError] = useState<string | null>(null);
  const listRef = useRef<SectionList>(null);
  const [showForm, setShowForm] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const longPressTriggered = useRef(false);
  const longPressResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openForm = () => {
    setShowForm(true);
    try {
      listRef.current?.scrollToLocation({
        sectionIndex: 0,
        itemIndex: 0,
        animated: true,
      });
    } catch {
      // liste vide : le formulaire est déjà visible en tête
    }
  };

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [accs, groups] = await Promise.all([
      listAccounts(db),
      listAccountGroups(db),
    ]);
    return { accounts: accs, accountGroups: groups };
  }, []);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const accounts = useMemo(() => resource.data?.accounts ?? [], [resource.data?.accounts]);
  const accountGroups = useMemo(
    () => resource.data?.accountGroups ?? [],
    [resource.data?.accountGroups],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const submit = async () => {
    if (!name.trim()) {
      return;
    }
    setFormError(null);
    try {
      const db = await getDatabase();
      await createAccount(db, { name, groupId: groupId ?? accountGroups[0]?.id ?? null });
      setName("");
      setGroupId(null);
      setShowForm(false);
      await resource.reload();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Impossible de créer le compte.");
    }
  };

  const closeAccountActions = () => setSelectedAccount(null);

  const updateFlags = async (
    accountId: number,
    flags: { hidden?: boolean; excludeFromTotal?: boolean },
  ) => {
    try {
      const db = await getDatabase();
      await updateAccountFlags(db, accountId, flags);
      await resource.reload();
    } catch (error) {
      Alert.alert(
        "Modification impossible",
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    }
  };

  const confirmHide = (account: Account) => {
    const nextHidden = !account.hidden;
    closeAccountActions();
    Alert.alert(
      nextHidden ? `Masquer « ${account.name} » ?` : `Afficher « ${account.name} » ?`,
      nextHidden
        ? "Le compte ne sera plus visible dans la liste principale ni dans les sélecteurs de transaction."
        : "Le compte redeviendra visible dans la liste principale et les sélecteurs de transaction.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: nextHidden ? "Masquer" : "Afficher",
          onPress: () => void updateFlags(account.id, { hidden: nextHidden }),
        },
      ],
    );
  };

  const confirmExcludeFromTotal = (account: Account) => {
    const nextExcluded = !account.excludeFromTotal;
    closeAccountActions();
    Alert.alert(
      nextExcluded
        ? `Exclure « ${account.name} » du total ?`
        : `Inclure « ${account.name} » dans le total ?`,
      nextExcluded
        ? "Le solde de ce compte ne sera plus compté dans le patrimoine ni dans les prévisions."
        : "Le solde de ce compte sera de nouveau compté dans le patrimoine et les prévisions.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: nextExcluded ? "Exclure" : "Inclure",
          onPress: () =>
            void updateFlags(account.id, { excludeFromTotal: nextExcluded }),
        },
      ],
    );
  };

  const confirmDelete = (account: Account) => {
    closeAccountActions();
    Alert.alert(
      `Supprimer « ${account.name} » ?`,
      "Le compte sera déplacé vers les comptes supprimés et pourra être restauré. Ses transactions seront masquées des listes.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await deleteAccount(db, account.id);
              await resource.reload();
            } catch (error) {
              Alert.alert(
                "Suppression impossible",
                error instanceof Error ? error.message : "Une erreur est survenue.",
              );
            }
          },
        },
      ],
    );
  };

  const openAccountActions = (account: Account) => {
    setSelectedAccount(account);
  };

  const sections = useMemo(() => {
    const visible = (accounts ?? []).filter((a) => !a.hidden || showHidden);
    const groups = new Map<
      string,
      { key: string; title: string; data: Account[] }
    >();
    for (const account of visible) {
      const key = account.groupId != null ? String(account.groupId) : "none";
      const section = groups.get(key) ?? {
        key,
        title: account.groupName ?? "Sans groupe",
        data: [],
      };
      section.data.push(account);
      groups.set(key, section);
    }
    return [...groups.values()].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }, [accounts, showHidden]);

  const totals = useMemo(() => {
    const eligible = (accounts ?? []).filter((a) => !a.excludeFromTotal);
    const actifs = eligible
      .filter((a) => a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0);
    const passifs = eligible
      .filter((a) => a.balance < 0)
      .reduce((sum, a) => sum + a.balance, 0);
    const available = eligible.reduce((sum, a) => sum + a.availableBalance, 0);
    return { actifs, passifs, solde: actifs + passifs, available };
  }, [accounts]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
              <IconButton
                onPress={() => router.push("/goals")}
                label="Ouvrir les objectifs"
                icon={<Target size={21} strokeWidth={2.2} color={theme.accent} />}
              />
              <IconButton
                onPress={() => (showForm ? setShowForm(false) : openForm())}
                label={showForm ? "Fermer le formulaire de compte" : "Ajouter un compte"}
                icon={showForm ? (
                  <X size={22} strokeWidth={2.2} color={theme.accent} />
                ) : (
                  <Plus size={22} strokeWidth={2.2} color={theme.accent} />
                )}
              />
            </View>
          ),
        }}
      />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={resource.error?.message}
          onRetry={() => void resource.reload()}
        />
      ) : (
      <SectionList
      ref={listRef}
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
      sections={sections}
      keyExtractor={(a) => String(a.id)}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionHeaderText, { color: theme.secondaryLabel }]}>
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item, index, section }) => {
        const isLast = index === section.data.length - 1;
        return (
          <>
            <Pressable
              onPress={() => {
                if (longPressTriggered.current) {
                  longPressTriggered.current = false;
                  if (longPressResetTimer.current != null) {
                    clearTimeout(longPressResetTimer.current);
                    longPressResetTimer.current = null;
                  }
                  return;
                }
                router.push({ pathname: "/accounts/[id]", params: { id: String(item.id) } });
              }}
              onLongPress={() => {
                longPressTriggered.current = true;
                if (longPressResetTimer.current != null) {
                  clearTimeout(longPressResetTimer.current);
                }
                longPressResetTimer.current = setTimeout(() => {
                  longPressTriggered.current = false;
                  longPressResetTimer.current = null;
                }, 1500);
                openAccountActions(item);
              }}
              accessibilityHint="Appuyez longuement pour gérer ce compte."
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.surface, marginHorizontal: spacing.lg },
                isLast && styles.rowLast,
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
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  selectable
                  style={[
                    styles.balance,
                    {
                      color:
                        item.availableBalance > 0
                          ? theme.income
                          : item.availableBalance < 0
                            ? theme.expense
                            : theme.secondaryLabel,
                    },
                  ]}
                >
                  {formatAmount(item.availableBalance)}
                </Text>
                {item.reservedAmount > 0 ? (
                  <Text style={[styles.totalBalance, { color: theme.secondaryLabel }]}>
                    total {formatAmount(item.balance)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            {!isLast ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.separator,
                  marginLeft: spacing.lg + 22,
                  marginRight: spacing.lg,
                }}
              />
            ) : null}
          </>
        );
      }}
      ListHeaderComponent={
        <View style={{ gap: spacing.lg }}>
          <View
            style={{
              marginHorizontal: spacing.lg,
              backgroundColor: theme.surface,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.xs,
            }}
          >
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Patrimoine</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                  Actifs
                </Text>
                <Text
                  selectable
                  style={{ color: theme.income, fontWeight: "700", fontVariant: ["tabular-nums"] }}
                >
                  + {formatAmount(totals.actifs)}
                </Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryItemCenter]}>
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                  Passifs
                </Text>
                <Text
                  selectable
                  style={{ color: theme.expense, fontWeight: "700", fontVariant: ["tabular-nums"] }}
                >
                  {formatAmount(totals.passifs)}
                </Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryItemRight]}>
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                  Solde
                </Text>
                <Text
                  selectable
                  style={{
                    color: totals.solde >= 0 ? theme.label : theme.expense,
                    fontWeight: "800",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatAmount(totals.solde)}
                </Text>
              </View>
            </View>
            <View style={[styles.availableSummary, { borderTopColor: theme.separator }]}>
              <View>
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Disponible</Text>
                <Text
                  selectable
                  style={{
                    color: totals.available >= 0 ? theme.label : theme.expense,
                    fontWeight: "800",
                    fontSize: 18,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatAmount(totals.available)}
                </Text>
              </View>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13, flex: 1, textAlign: "right" }}>
                Après les réservations d&apos;objectifs
              </Text>
            </View>
            {(accounts ?? []).some((a) => a.excludeFromTotal) ? (
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                {(accounts ?? []).filter((a) => a.excludeFromTotal).length} compte
                {(accounts ?? []).filter((a) => a.excludeFromTotal).length > 1 ? "s" : ""}{" "}
                exclu{(accounts ?? []).filter((a) => a.excludeFromTotal).length > 1 ? "s" : ""}{" "}
                du total
              </Text>
            ) : null}
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                paddingHorizontal: spacing.lg,
                color: theme.secondaryLabel,
                fontSize: 13,
                fontWeight: "600",
                letterSpacing: 1.1,
              }}
            >
              COMPTES
            </Text>
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
          </View>
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
              {formError ? <InlineError message={formError} onRetry={() => setFormError(null)} /> : null}
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
                label="Groupe de comptes"
                value={
                  accountGroups.find((g) => g.id === groupId)?.name ?? null
                }
                options={accountGroups.map((g) => ({ id: g.id, label: g.name }))}
                onChange={setGroupId}
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
        (accounts ?? []).length === 0 ? (
          <EmptyState
            title="Aucun compte"
            message="Créez votre premier compte pour commencer à suivre vos transactions."
            actionLabel="Créer un compte"
            onAction={openForm}
          />
        ) : (
          <View style={{ padding: spacing.xl }}>
            <Text style={{ color: theme.secondaryLabel, textAlign: "center" }}>
              Aucun compte visible.
            </Text>
          </View>
        )
      }
      />
      )}

      <Modal
        visible={selectedAccount != null}
        transparent
        animationType="fade"
        onRequestClose={closeAccountActions}
      >
        <Pressable
          style={styles.backdrop}
          onPress={closeAccountActions}
          accessibilityLabel="Fermer"
        >
          <Pressable style={[styles.actionSheet, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.actionSheetTitle, { color: theme.label }]}>
              {selectedAccount?.name}
            </Text>
            <Text style={[styles.actionSheetSubtitle, { color: theme.secondaryLabel }]}>
              Gérer ce compte
            </Text>

            <View style={[styles.actionDivider, { backgroundColor: theme.separator }]} />

            <Pressable
              onPress={() => {
                const account = selectedAccount;
                closeAccountActions();
                if (account) {
                  router.push({ pathname: "/accounts/[id]", params: { id: String(account.id) } });
                }
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.actionText, { color: theme.label }]}>Ouvrir le compte</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const account = selectedAccount;
                if (account) {
                  confirmHide(account);
                }
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.actionText, { color: theme.label }]}>
                {selectedAccount?.hidden ? "Afficher le compte" : "Masquer le compte"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const account = selectedAccount;
                if (account) {
                  confirmExcludeFromTotal(account);
                }
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.actionText, { color: theme.label }]}>
                {selectedAccount?.excludeFromTotal
                  ? "Inclure dans le total"
                  : "Exclure du total"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const account = selectedAccount;
                if (account) {
                  confirmDelete(account);
                }
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.actionText, { color: theme.expense }]}>Supprimer le compte</Text>
            </Pressable>

            <View style={[styles.actionDivider, { backgroundColor: theme.separator }]} />

            <Pressable
              onPress={closeAccountActions}
              accessibilityRole="button"
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.actionText, { color: theme.accent, fontWeight: "700" }]}>Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  rowLast: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingBottom: spacing.md + spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    gap: spacing.xs,
    alignItems: "flex-start",
  },
  summaryItemCenter: {
    alignItems: "center",
  },
  summaryItemRight: {
    alignItems: "flex-end",
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
  balance: {
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  totalBalance: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  availableSummary: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  actionSheetTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  actionSheetSubtitle: {
    fontSize: 13,
    marginTop: spacing.xs,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  actionRow: {
    minHeight: 48,
    justifyContent: "center",
  },
  actionText: {
    fontSize: 16,
  },
});
