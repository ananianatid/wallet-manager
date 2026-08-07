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
import { IconButton, InlineError, KeyboardAwareView, ScreenState } from "@/components/ui";
import { listAccountGroups } from "@/db/account-groups";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccountFlags,
} from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { useCurrency, useCurrencyConverter } from "@/currency/context";
import { currencyLabel } from "@/currency/currencies";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import type { Account } from "@/types";
import { formatAmount } from "@/utils/format";

export default function AccountsScreen() {
  const theme = useTheme();
  const { baseCurrency, currencies } = useCurrency();
  const convert = useCurrencyConverter();
  const summaryLabel = theme.accentSurfaceLabel;
  const [formError, setFormError] = useState<string | null>(null);
  const listRef = useRef<SectionList>(null);
  const [showForm, setShowForm] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [currencyCode, setCurrencyCode] = useState(baseCurrency);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const longPressTriggered = useRef(false);
  const longPressResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openForm = () => {
    setShowForm(true);
    setCurrencyCode(baseCurrency);
    try {
      listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
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
  const groupOptions = useMemo(
    () => [
      { id: -1, label: "Sans groupe" },
      ...accountGroups.map((g) => ({ id: g.id, label: g.name })),
    ],
    [accountGroups],
  );
  const currencyOptions = useMemo(
    () => currencies.map((currency, index) => ({
      id: index + 1,
      label: currencyLabel(currency),
      code: currency.code,
    })),
    [currencies],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const submit = async () => {
    if (!name.trim()) {
      setFormError("Saisissez un nom de compte.");
      return;
    }
    setFormError(null);
    try {
      const db = await getDatabase();
      await createAccount(db, { name, groupId, currencyCode });
      setName("");
      setGroupId(null);
      setCurrencyCode(baseCurrency);
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
    const byGroup = new Map<
      string,
      { key: string; title: string; data: Account[] }
    >();
    for (const account of visible) {
      const key = account.groupId != null ? String(account.groupId) : "none";
      const section = byGroup.get(key) ?? {
        key,
        title: account.groupName ?? "Sans groupe",
        data: [],
      };
      section.data.push(account);
      byGroup.set(key, section);
    }
    // Respect the user's group order (sort_order) from the groups screen.
    const ordered: { key: string; title: string; data: Account[] }[] = [];
    for (const group of accountGroups) {
      const section = byGroup.get(String(group.id));
      if (section) {
        ordered.push(section);
      }
    }
    const ungrouped = byGroup.get("none");
    if (ungrouped) {
      ordered.push(ungrouped);
    }
    // Fallback: sections whose group is no longer listed, by name.
    for (const section of byGroup.values()) {
      if (!ordered.includes(section)) {
        ordered.push(section);
      }
    }
    return ordered;
  }, [accounts, showHidden, accountGroups]);

  const totals = useMemo(() => {
    const eligible = (accounts ?? []).filter((a) => !a.excludeFromTotal);
    const values = eligible.map((a) => ({
      balance: convert(a.balance, a.currencyCode) ?? 0,
      available: convert(a.availableBalance, a.currencyCode) ?? 0,
    }));
    const actifs = values
      .filter((a) => a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0);
    const passifs = values
      .filter((a) => a.balance < 0)
      .reduce((sum, a) => sum + a.balance, 0);
    const available = values.reduce((sum, a) => sum + a.available, 0);
    return { actifs, passifs, solde: actifs + passifs, available };
  }, [accounts, convert]);

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
      <KeyboardAwareView>
        <SectionList
        ref={listRef}
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
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
              accessibilityRole="button"
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
                  {formatAmount(item.availableBalance, item.currencyCode)}
                </Text>
                {item.currencyCode !== baseCurrency ? (
                  <Text style={[styles.totalBalance, { color: theme.secondaryLabel }]}>
                    {(() => {
                      const equivalent = convert(item.availableBalance, item.currencyCode);
                      return equivalent == null
                        ? `— ${baseCurrency}`
                        : `≈ ${formatAmount(equivalent, baseCurrency)}`;
                    })()}
                  </Text>
                ) : null}
                {item.reservedAmount > 0 ? (
                  <Text style={[styles.totalBalance, { color: theme.secondaryLabel }]}>
                    total {formatAmount(item.balance, item.currencyCode)}
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
              backgroundColor: theme.accentSurface,
              borderRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.xs,
            }}
          >
            <Text style={{ color: summaryLabel, fontSize: 13 }}>Patrimoine</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={{ color: summaryLabel, fontSize: 13 }}>
                  Actifs
                </Text>
                <Text
                  selectable
                  style={{ color: theme.accentSurfaceIncome, fontWeight: "700", fontVariant: ["tabular-nums"] }}
                >
                  + {formatAmount(totals.actifs)}
                </Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryItemCenter]}>
                <Text style={{ color: summaryLabel, fontSize: 13 }}>
                  Passifs
                </Text>
                <Text
                  selectable
                  style={{ color: theme.accentSurfaceExpense, fontWeight: "700", fontVariant: ["tabular-nums"] }}
                >
                  {formatAmount(totals.passifs)}
                </Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryItemRight]}>
                <Text style={{ color: summaryLabel, fontSize: 13 }}>
                  Solde
                </Text>
                <Text
                  selectable
                  style={{
                    color:
                      totals.solde >= 0
                        ? theme.accentSurfaceText
                        : theme.accentSurfaceExpense,
                    fontWeight: "800",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatAmount(totals.solde)}
                </Text>
              </View>
            </View>
            {(accounts ?? []).some((a) => a.excludeFromTotal) ? (
              <Text style={{ color: summaryLabel, fontSize: 13 }}>
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
                accessibilityLabel="Nom du compte"
                maxLength={40}
                style={{
                  color: theme.label,
                  backgroundColor: theme.surfaceElevated,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                  borderRadius: radius.md,
                }}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
              />
              <SelectField
                label="Groupe de comptes"
                value={
                  groupId == null
                    ? "Sans groupe"
                    : (accountGroups.find((g) => g.id === groupId)?.name ?? null)
                }
                options={groupOptions}
                onChange={(id) => setGroupId(id === -1 ? null : id)}
              />
              <SelectField
                label="Devise du compte"
                value={currencyOptions.find((option) => option.code === currencyCode)?.label ?? currencyCode}
                options={currencyOptions}
                onChange={(id) => setCurrencyCode(currencyOptions.find((option) => option.id === id)?.code ?? baseCurrency)}
              />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  onPress={() => setShowForm(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Annuler la création du compte"
                  style={({ pressed }) => [styles.button, { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: theme.secondaryLabel, fontWeight: "600" }}>Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={submit}
                  accessibilityRole="button"
                  accessibilityLabel="Créer le compte"
                  style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, flex: 1 }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ color: theme.onAccent, fontWeight: "700" }}>Créer</Text>
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
      </KeyboardAwareView>
      )}

      <Modal
        visible={selectedAccount != null}
        transparent
        animationType="slide"
        onRequestClose={closeAccountActions}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.scrim }]}
          onPress={closeAccountActions}
          accessibilityLabel="Fermer"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            accessibilityViewIsModal
            style={[styles.actionSheet, { backgroundColor: theme.surfaceElevated }]}
          >
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
  button: {
    minHeight: 48,
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
