import { useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import {
  ArrowUpDown,
  Check,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Trash,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { EmptyState } from "@/components/empty-state";
import { IconButton, InlineError, KeyboardAwareScreen, ScreenState } from "@/components/ui";
import {
  assignAccountGroup,
  createAccountGroup,
  listAccountGroups,
  listDeletedAccountGroups,
  renameAccountGroup,
  reorderAccountGroups,
  restoreAccountGroup,
  softDeleteAccountGroup,
} from "@/db/account-groups";
import { listAccounts } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import type { Account, AccountGroup } from "@/types";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

const countLabel = (count: number): string =>
  count === 0 ? "Aucun compte" : `${count} compte${count > 1 ? "s" : ""}`;

const REORDER_ROW_HEIGHT = 56;

function ReorderRow({
  item,
  index,
  count,
  onReorder,
}: {
  item: AccountGroup;
  index: number;
  count: number;
  onReorder: (from: number, to: number) => void;
}) {
  const theme = useTheme();
  const [translateY] = useState(() => new Animated.Value(0));
  const [dragging, setDragging] = useState(false);

  const reset = useCallback(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: Platform.OS !== "web" }).start();
    setDragging(false);
  }, [translateY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 5 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => setDragging(true),
        onPanResponderMove: (_, gesture) => translateY.setValue(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          const target = Math.max(
            0,
            Math.min(
              count - 1,
              index + Math.round(gesture.dy / REORDER_ROW_HEIGHT),
            ),
          );
          reset();
          if (target !== index) {
            onReorder(index, target);
          }
        },
        onPanResponderTerminate: reset,
      }),
    [index, count, onReorder, translateY, reset],
  );

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        zIndex: dragging ? 1 : 0,
        elevation: dragging ? 2 : 0,
      }}
    >
      <View
        style={[styles.row, { height: REORDER_ROW_HEIGHT, backgroundColor: theme.surface }]}
        {...pan.panHandlers}
      >
        <GripVertical size={20} color={theme.secondaryLabel} strokeWidth={2} />
        <Text style={[styles.name, { color: theme.label }]}>{item.name}</Text>
        <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
          {countLabel(item.accountCount)}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function AccountGroupsScreen() {
  const theme = useTheme();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [membershipGroup, setMembershipGroup] = useState<AccountGroup | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [groups, deletedGroups, accounts] = await Promise.all([
      listAccountGroups(db),
      listDeletedAccountGroups(db),
      listAccounts(db),
    ]);
    return { groups, deletedGroups, accounts };
  }, []);

  const resource = useAsyncResource(load, "groups.load");
  const reload = resource.reload;
  const groups = resource.data?.groups ?? [];
  const deletedGroups = resource.data?.deletedGroups ?? [];
  const accounts = resource.data?.accounts ?? [];

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const orderedGroups = reorderMode
    ? order
        .map((id) => groups.find((g) => g.id === id))
        .filter((g): g is AccountGroup => g != null)
    : groups;

  const toggleReorder = () => {
    const next = !reorderMode;
    setReorderMode(next);
    if (next) {
      setOrder(groups.map((g) => g.id));
    }
  };

  const add = async () => {
    if (!newName.trim()) {
      setFormError("Saisissez un nom pour le groupe.");
      return;
    }
    setFormError(null);
    try {
      const db = await getDatabase();
      await createAccountGroup(db, newName);
      setNewName("");
      setAdding(false);
      await reload();
    } catch (e) {
      log.error("groups.add", "Échec de la création du groupe", e);
      Alert.alert("Impossible d'ajouter", userMessage(e));
    }
  };

  const startRename = (group: AccountGroup) => {
    setEditingId(group.id);
    setEditName(group.name);
    setFormError(null);
  };

  const saveRename = async (id: number) => {
    if (!editName.trim()) {
      setFormError("Saisissez un nom pour le groupe.");
      return;
    }
    setFormError(null);
    try {
      const db = await getDatabase();
      await renameAccountGroup(db, id, editName);
      setEditingId(null);
      await reload();
    } catch (e) {
      log.error("groups.rename", "Échec du renommage du groupe", e);
      Alert.alert("Impossible de renommer", userMessage(e));
    }
  };

  const confirmDelete = (group: AccountGroup) => {
    Alert.alert(
      `Supprimer « ${group.name} » ?`,
      group.accountCount > 0
        ? `Les ${group.accountCount} compte${
            group.accountCount > 1 ? "s" : ""
          } seront conservés mais deviendront sans groupe.`
        : "Ce groupe sera déplacé vers les groupes supprimés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await softDeleteAccountGroup(db, group.id);
              await reload();
            } catch (e) {
              log.error("groups.delete", "Échec de la suppression du groupe", e);
              Alert.alert("Suppression impossible", userMessage(e));
            }
          },
        },
      ],
    );
  };

  const handleReorder = async (from: number, to: number) => {
    const next = [...orderedGroups];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const ids = next.map((g) => g.id);
    setOrder(ids);
    try {
      const db = await getDatabase();
      await reorderAccountGroups(db, ids);
    } catch (e) {
      log.error("groups.reorder", "Échec de la réorganisation des groupes", e);
      Alert.alert("Réorganisation impossible", userMessage(e));
      await reload();
    }
  };

  const restore = async (group: AccountGroup) => {
    try {
      const db = await getDatabase();
      await restoreAccountGroup(db, group.id);
      await reload();
    } catch (e) {
      log.error("groups.restore", "Échec de la restauration du groupe", e);
      Alert.alert("Restauration impossible", userMessage(e));
    }
  };

  const toggleMember = async (account: Account) => {
    if (!membershipGroup) {
      return;
    }
    const groupId = account.groupId === membershipGroup.id ? null : membershipGroup.id;
    try {
      const db = await getDatabase();
      await assignAccountGroup(db, account.id, groupId);
      await reload();
    } catch (e) {
      log.error("groups.assign", "Échec de l'affectation du compte au groupe", e);
      Alert.alert("Impossible d'affecter", userMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Groupes de comptes",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <IconButton
                label="Ajouter un groupe de comptes"
                onPress={() => {
                  setAdding((v) => !v);
                  setNewName("");
                }}
                icon={<Plus size={22} color={theme.accent} strokeWidth={2.2} />}
              />
              <IconButton
                label="Réorganiser les groupes"
                onPress={toggleReorder}
                selected={reorderMode}
                icon={
                  <ArrowUpDown
                    size={22}
                    color={reorderMode ? theme.accent : theme.secondaryLabel}
                    strokeWidth={2.2}
                  />
                }
              />
            </View>
          ),
        }}
      />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={userMessage(resource.error)}
          onRetry={() => void resource.reload()}
        />
      ) : reorderMode ? (
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.sm }}>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: radius.lg,
              borderCurve: "continuous",
              overflow: "hidden",
            }}
          >
            {orderedGroups.map((group, index) => (
              <View key={group.id}>
                <ReorderRow
                  item={group}
                  index={index}
                  count={orderedGroups.length}
                  onReorder={handleReorder}
                />
                {index < orderedGroups.length - 1 ? (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: theme.separator,
                      marginLeft: spacing.lg,
                    }}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : (
        <KeyboardAwareScreen
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xxl,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: radius.lg,
              borderCurve: "continuous",
            }}
          >
            {adding ? (
              <View style={[styles.row, { gap: spacing.sm }]}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nouveau groupe"
                  placeholderTextColor={theme.secondaryLabel}
                  accessibilityLabel="Nom du nouveau groupe de comptes"
                  maxLength={40}
                  style={[
                    styles.input,
                    { backgroundColor: theme.surfaceElevated, color: theme.label },
                  ]}
                  autoFocus
                  onSubmitEditing={add}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={add}
                  disabled={!newName.trim()}
                  accessibilityState={{ disabled: !newName.trim() }}
                  style={({ pressed }) => [
                    styles.addButton,
                    { backgroundColor: theme.accent },
                    (pressed || !newName.trim()) && styles.pressed,
                  ]}
                >
                  <Text style={{ color: theme.onAccent, fontWeight: "700" }}>Ajouter</Text>
                </Pressable>
              </View>
            ) : null}
            {adding && formError ? <InlineError message={formError} /> : null}

            {orderedGroups.map((group, index) => (
              <View key={group.id}>
                {index > 0 || adding ? (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: theme.separator,
                      marginLeft: spacing.lg,
                    }}
                  />
                ) : null}

                {editingId === group.id ? (
                  <View style={[styles.row, { gap: spacing.sm }]}>
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      style={[
                        styles.input,
                        { backgroundColor: theme.surfaceElevated, color: theme.label },
                      ]}
                      accessibilityLabel={`Nom du groupe ${group.name}`}
                      maxLength={40}
                      autoFocus
                      onSubmitEditing={() => saveRename(group.id)}
                      returnKeyType="done"
                    />
                    <Pressable
                      onPress={() => saveRename(group.id)}
                      disabled={!editName.trim()}
                      accessibilityState={{ disabled: !editName.trim() }}
                      style={({ pressed }) => [
                        styles.addButton,
                        { backgroundColor: theme.accent },
                        (pressed || !editName.trim()) && styles.pressed,
                      ]}
                    >
                      <Text style={{ color: theme.onAccent, fontWeight: "700" }}>OK</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <Pressable
                      onPress={() => setMembershipGroup(group)}
                      accessibilityRole="button"
                      accessibilityLabel={`Gérer les comptes du groupe ${group.name}`}
                      style={({ pressed }) => [
                        styles.groupBody,
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={[styles.name, { color: theme.label }]}>
                        {group.name}
                      </Text>
                      <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                        {countLabel(group.accountCount)}
                      </Text>
                      <ChevronRight size={18} color={theme.secondaryLabel} strokeWidth={2} />
                    </Pressable>
                    <View style={styles.rowActions}>
                      <IconButton
                        label={`Renommer ${group.name}`}
                        onPress={() => startRename(group)}
                        icon={<Pencil size={18} color={theme.secondaryLabel} strokeWidth={2} />}
                      />
                      <IconButton
                        label={`Supprimer ${group.name}`}
                        onPress={() => confirmDelete(group)}
                        icon={<Trash size={18} color={theme.expense} strokeWidth={2} />}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}

            {groups.length === 0 && !adding ? (
              <EmptyState
                title="Aucun groupe"
                message="Créez un groupe pour organiser vos comptes."
              />
            ) : null}
          </View>

          {deletedGroups.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[styles.eyebrow, { color: theme.secondaryLabel }]}>SUPPRIMÉS</Text>
              <View
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: radius.lg,
                  borderCurve: "continuous",
                  opacity: 0.6,
                }}
              >
                {deletedGroups.map((group, index) => (
                  <View key={group.id}>
                    {index > 0 ? (
                      <View
                        style={{
                          height: StyleSheet.hairlineWidth,
                          backgroundColor: theme.separator,
                          marginLeft: spacing.lg,
                        }}
                      />
                    ) : null}
                    <View style={styles.row}>
                      <Text style={[styles.name, { color: theme.label }]}>{group.name}</Text>
                      <Pressable
                        onPress={() => restore(group)}
                        hitSlop={8}
                        accessibilityLabel={`Restaurer ${group.name}`}
                      >
                        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "600" }}>
                          Restaurer
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </KeyboardAwareScreen>
      )}

      <Modal
        visible={membershipGroup != null}
        transparent
        animationType="slide"
        onRequestClose={() => setMembershipGroup(null)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.scrim }]}
          onPress={() => setMembershipGroup(null)}
          accessibilityLabel="Fermer"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}
          >
            <Text style={[styles.sheetTitle, { color: theme.label }]}>
              {membershipGroup?.name}
            </Text>
            <FlatList
              data={accounts}
              keyExtractor={(account) => String(account.id)}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const isMember = item.groupId === membershipGroup?.id;
                return (
                  <Pressable
                    onPress={() => toggleMember(item)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={item.name}
                    accessibilityState={{ checked: isMember }}
                    style={({ pressed }) => [
                      styles.option,
                      { backgroundColor: pressed ? theme.surface : "transparent" },
                      item.hidden && { opacity: 0.5 },
                    ]}
                  >
                    <Text
                      style={[styles.optionName, { color: theme.label }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <View
                      style={[
                        styles.checkBox,
                        {
                          borderColor: isMember ? theme.accent : theme.outline,
                          backgroundColor: isMember ? theme.accent : "transparent",
                        },
                      ]}
                    >
                      {isMember ? (
                        <Check size={14} strokeWidth={3} color={theme.onAccent} />
                      ) : null}
                    </View>
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
  eyebrow: { fontSize: 13, fontWeight: "700", letterSpacing: 0.8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  groupBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 24,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    marginRight: -spacing.md,
  },
  name: {
    flex: 1,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  addButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
  pressed: { opacity: 0.55 },
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
  optionName: {
    flex: 1,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
});
