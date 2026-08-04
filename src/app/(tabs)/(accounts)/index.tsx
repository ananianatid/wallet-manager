import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { Eye, EyeOff, Plus, Target, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  SectionList,
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

  const sections = useMemo(() => {
    const visible = (accounts ?? []).filter((a) => !a.hidden || showHidden);
    const groups = new Map<
      string,
      { key: string; title: string; data: Account[] }
    >();
    for (const account of visible) {
      const key = String(account.categoryId);
      const section = groups.get(key) ?? {
        key,
        title: account.categoryName,
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
              <Pressable
                onPress={() => router.push("/goals")}
                hitSlop={8}
                accessibilityLabel="Ouvrir les objectifs"
              >
                <Target size={21} strokeWidth={2.2} color={theme.accent} />
              </Pressable>
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
            </View>
          ),
        }}
      />
      <SectionList
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
              onPress={() => router.push({ pathname: "/accounts/[id]", params: { id: String(item.id) } })}
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
        (accounts ?? []).length === 0 ? (
          <EmptyState
            title="Aucun compte"
            message="Créez votre premier compte pour commencer à suivre vos transactions."
            actionLabel="Créer un compte"
            onAction={() => setShowForm(true)}
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
});
