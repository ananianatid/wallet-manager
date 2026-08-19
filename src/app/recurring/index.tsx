import { router, Stack, useFocusEffect } from "expo-router";
import { Plus, Trash } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getDatabase } from "@/db/database";
import { CategoryIcon } from "@/components/category-icons";
import { IconButton, InlineError, ScreenState } from "@/components/ui";
import {
  applyDueRecurring,
  deleteRecurring,
  listRecurring,
} from "@/db/recurring";
import { radius, spacing, typography, useTheme } from "@/theme";
import { useAsyncResource } from "@/hooks/use-async-resource";
import type { RecurringTransaction } from "@/types";
import { formatAmount, formatDate } from "@/utils/format";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Tous les jours",
  weekly: "Toutes les semaines",
  monthly: "Tous les mois",
  yearly: "Tous les ans",
};

const TYPE_LABELS: Record<string, string> = {
  income: "Revenu",
  expense: "Dépense",
  transfer: "Transfert",
};

export default function RecurringScreen() {
  const theme = useTheme();
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    return listRecurring(db);
  }, []);

  const resource = useAsyncResource(load, "recurring.load");
  const reload = resource.reload;
  const items = resource.data ?? [];

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const confirmDelete = (item: RecurringTransaction) => {
    Alert.alert("Supprimer cette récurrence ?", "Les transactions déjà créées sont conservées.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const db = await getDatabase();
          await deleteRecurring(db, item.id);
          await load();
        },
      },
    ]);
  };

  const generateNow = async () => {
    setGenerating(true);
    setActionError(null);
    try {
      const db = await getDatabase();
      await applyDueRecurring(db);
      await resource.reload();
    } catch (e) {
      setActionError(userMessage(e));
      log.error("recurring.generate", "Échec de la génération des échéances", e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Transactions récurrentes",
          headerRight: () => (
            <IconButton
              onPress={() => router.push("/recurring/form")}
              label="Ajouter une récurrence"
              icon={<Plus size={22} strokeWidth={2.2} color={theme.accent} />}
            />
          ),
        }}
      />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={userMessage(resource.error)}
          onRetry={() => void resource.reload()}
        />
      ) : (
      <FlatList
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({ pathname: "/recurring/form", params: { id: String(item.id) } })
            }
            accessibilityRole="button"
            accessibilityLabel={`${TYPE_LABELS[item.type]} de ${formatAmount(item.amount, item.sourceCurrencyCode)}`}
            accessibilityHint="Ouvre cette règle pour la modifier."
            style={({ pressed }) => [
              styles.row,
              !item.isActive && { opacity: 0.45 },
              pressed && { opacity: 0.6, transform: [{ scale: 0.99 }] },
            ]}
          >
            {item.categoryIcon ? (
              <View style={[styles.categoryIcon, { backgroundColor: theme.surfaceElevated }]}>
                <CategoryIcon name={item.categoryIcon} size={18} color={theme.accent} />
              </View>
            ) : (
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: item.isActive
                      ? item.type === "income"
                        ? theme.income
                        : item.type === "expense"
                          ? theme.expense
                          : theme.accent
                      : theme.separator,
                  },
                ]}
              />
            )}
            <View style={styles.body}>
              <Text style={[styles.title, { color: theme.label }]} numberOfLines={2}>
                {TYPE_LABELS[item.type]} · {formatAmount(item.amount, item.sourceCurrencyCode)}
                {item.fee ? ` + frais ${formatAmount(item.fee, item.sourceCurrencyCode)}` : ""}
              </Text>
              <Text style={[styles.detail, { color: theme.secondaryLabel }]} numberOfLines={2}>
                {item.accountName}
                {item.destinationAccountName
                  ? ` → ${item.destinationAccountName}`
                  : item.categoryName
                    ? ` · ${item.categoryName}`
                    : ""}
              </Text>
              <Text style={[styles.detail, { color: theme.secondaryLabel }]} numberOfLines={2}>
                {item.interval > 1
                  ? `Tous les ${item.interval} ${
                      item.frequency === "daily"
                        ? "jours"
                        : item.frequency === "weekly"
                          ? "semaines"
                          : item.frequency === "monthly"
                            ? "mois"
                            : "ans"
                    }`
                  : FREQUENCY_LABELS[item.frequency]}{" "}
                · prochaine : {formatDate(item.nextDate)}
              </Text>
            </View>
            <IconButton
              label="Supprimer cette récurrence"
              hint="Supprime cette règle après confirmation."
              onPress={() => confirmDelete(item)}
              icon={<Trash size={18} color={theme.expense} strokeWidth={2} />}
            />
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
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <View style={styles.intro}>
                <Text accessibilityRole="header" style={[styles.introTitle, { color: theme.label }]}>Automatisez les échéances</Text>
                <Text style={[styles.introBody, { color: theme.secondaryLabel }]}>Les revenus, dépenses et transferts prévisibles se créent au bon moment.</Text>
              </View>
              {actionError ? <InlineError message={actionError} onRetry={() => void generateNow()} /> : null}
              {items.length > 0 ? (
                <>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 18, marginBottom: spacing.sm }}>
                Les échéances dues sont aussi vérifiées automatiquement à l’ouverture de Transactions.
              </Text>
              <Pressable
                onPress={generateNow}
                disabled={generating}
                style={({ pressed }) => [
                  styles.generateButton,
                  { backgroundColor: theme.accent },
                  (pressed || generating) && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: theme.onAccent, fontWeight: "700" }}>
                  {generating ? "Génération…" : "Générer les échéances dues"}
                </Text>
              </Pressable>
                </>
              ) : null}
            </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ color: theme.secondaryLabel, textAlign: "center" }}>
              Aucune transaction récurrente
            </Text>
            <Text style={{ color: theme.secondaryLabel, fontSize: 13, textAlign: "center" }}>
              Programmez un revenu, une dépense ou un transfert pour ne plus le saisir à chaque échéance.
            </Text>
            <Pressable
              onPress={() => router.push("/recurring/form")}
              accessibilityRole="button"
              accessibilityLabel="Créer une transaction récurrente"
              style={({ pressed }) => [styles.emptyAction, { backgroundColor: theme.accent }, pressed && { opacity: 0.72 }]}
            >
              <Plus size={18} color={theme.onAccent} strokeWidth={2.5} />
              <Text style={{ color: theme.onAccent, fontWeight: "700" }}>Créer une règle</Text>
            </Pressable>
          </View>
        }
      />
      )}
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
  categoryIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.section,
  },
  detail: {
    ...typography.label,
    fontWeight: "400",
  },
  intro: {
    gap: spacing.xs,
  },
  introTitle: typography.title,
  introBody: typography.body,
  generateButton: {
    alignSelf: "center",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyAction: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
  },
});
