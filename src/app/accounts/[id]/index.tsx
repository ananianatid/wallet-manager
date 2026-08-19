import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useMemo } from "react";
import {
  Alert,
  SectionList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { EmptyState } from "@/components/empty-state";
import { TransactionRow } from "@/components/transaction-row";
import { ScreenState } from "@/components/ui";
import { deleteAccount, getAccount } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { useCurrency, useCurrencyConverter } from "@/currency/context";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { listTransactionsByAccount } from "@/db/transactions";
import { radius, spacing, useTheme } from "@/theme";
import { formatAmount, formatDayLabel } from "@/utils/format";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";
import type { Transaction } from "@/types";

interface AccountDaySection {
  key: string;
  title: string;
  data: Transaction[];
}

export default function AccountDetailScreen() {
  const theme = useTheme();
  const { baseCurrency } = useCurrency();
  const convert = useCurrencyConverter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [acc, rows] = await Promise.all([
      getAccount(db, accountId),
      listTransactionsByAccount(db, accountId),
    ]);
    return { account: acc, transactions: rows };
  }, [accountId]);

  const resource = useAsyncResource(load, "accounts.detail");
  const reload = resource.reload;
  const account = resource.data?.account ?? null;
  const transactions = resource.data?.transactions;
  const sections = useMemo<AccountDaySection[]>(() => {
    const groups = new Map<string, AccountDaySection>();
    for (const transaction of transactions ?? []) {
      const date = new Date(transaction.transactionDate);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const section = groups.get(key) ?? {
        key,
        title: formatDayLabel(transaction.transactionDate),
        data: [],
      };
      section.data.push(transaction);
      groups.set(key, section);
    }
    return [...groups.values()];
  }, [transactions]);

  const openEdit = (transactionId: number) =>
    router.push({ pathname: "/new-transaction", params: { id: String(transactionId) } });

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const confirmDelete = () => {
    if (!account) {
      return;
    }
    Alert.alert(
      `Supprimer « ${account.name} » ?`,
      "Le compte sera déplacé vers les comptes supprimés et pourra être restauré. Ses transactions seront masquées des listes et ses transactions récurrentes seront désactivées.",
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
              log.error("accounts.delete", "Échec de la suppression du compte", e);
              Alert.alert("Suppression impossible", userMessage(e));
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
                onPress={() =>
                  router.push({
                    pathname: "/accounts/[id]/edit",
                    params: { id: String(account.id) },
                  })
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Modifier le compte"
                style={styles.headerAction}
              >
                <Text style={{ color: theme.accent, fontWeight: "600" }}>
                  Modifier
                </Text>
              </Pressable>
            ) : null,
        }}
      />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={userMessage(resource.error)}
          onRetry={() => void resource.reload()}
        />
      ) : !account ? (
        <ScreenState status="error" message="Ce compte est introuvable." />
      ) : (
      <SectionList
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
        sections={sections}
        keyExtractor={(t) => String(t.id)}
        renderSectionHeader={({ section }) => (
          <View style={[styles.dayHeader, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
            <Text accessibilityRole="header" style={[styles.dayTitle, { color: theme.label }]}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const isLast = index === section.data.length - 1;
          return (
            <View
              style={[
                styles.transactionGroupRow,
                { backgroundColor: theme.surface, borderColor: theme.separator },
                isLast && styles.transactionGroupRowLast,
              ]}
            >
              <TransactionRow transaction={item} onPress={() => openEdit(item.id)} />
              {!isLast ? (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: theme.separator,
                  }}
                />
              ) : null}
            </View>
          );
        }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={[styles.accountHero, { backgroundColor: theme.surfaceElevated }]}>
              <View style={{ gap: spacing.xs }}>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                {account?.groupName ?? ""}
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
                {account ? formatAmount(account.availableBalance, account.currencyCode) : "…"}
              </Text>
              <View style={{ gap: 2 }}>
                <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                  Disponible après réservations
                </Text>
                {account.currencyCode !== baseCurrency ? (
                  <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                    ≈ {convert(account.availableBalance, account.currencyCode) == null
                      ? `— ${baseCurrency}`
                      : formatAmount(convert(account.availableBalance, account.currencyCode)!, baseCurrency)} · taux actuel
                  </Text>
                ) : null}
                {account && account.reservedAmount > 0 ? (
                  <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                    Solde total : {formatAmount(account.balance, account.currencyCode)} · Réservé : {formatAmount(account.reservedAmount, account.currencyCode)}
                  </Text>
                ) : null}
              </View>
              </View>
            </View>
            {account.description ? (
              <View style={[styles.descriptionBlock, { backgroundColor: theme.surface }]}>
                <Text style={{ color: theme.secondaryLabel, fontSize: 14, lineHeight: 20 }}>
                  {account.description}
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={confirmDelete}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Supprimer le compte"
              style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.65 }]}
            >
              <Text style={{ color: theme.expense, fontWeight: "600" }}>
                Supprimer le compte
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucune transaction"
            message="Ajoutez un revenu ou une dépense pour commencer à suivre ce compte."
            actionLabel="Ajouter une transaction"
            onAction={() => router.push("/new-transaction")}
          />
        }
      />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  accountHero: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: 16,
    borderCurve: "continuous",
  },
  descriptionBlock: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderCurve: "continuous",
  },
  deleteButton: {
    alignSelf: "flex-start",
    minHeight: 48,
    justifyContent: "center",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  dayTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  transactionGroupRow: {
    marginHorizontal: spacing.lg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  transactionGroupRowLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    paddingBottom: spacing.sm,
  },
});
