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
import { radius, spacing, useTheme } from "@/theme";
import { useAsyncResource } from "@/hooks/use-async-resource";
import type { RecurringTransaction } from "@/types";
import { formatAmount, formatDate } from "@/utils/format";

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

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : "Une erreur est survenue.";

export default function RecurringScreen() {
  const theme = useTheme();
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    return listRecurring(db);
  }, []);

  const resource = useAsyncResource(load);
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
      setActionError(errorMessage(e));
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
          message={resource.error?.message}
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
            style={({ pressed }) => [
              styles.row,
              !item.isActive && { opacity: 0.45 },
              pressed && { opacity: 0.6 },
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
              <Text style={[styles.title, { color: theme.label }]} numberOfLines={1}>
                {TYPE_LABELS[item.type]} · {formatAmount(item.amount, item.sourceCurrencyCode)}
                {item.fee ? ` + frais ${formatAmount(item.fee, item.sourceCurrencyCode)}` : ""}
              </Text>
              <Text style={[styles.detail, { color: theme.secondaryLabel }]} numberOfLines={1}>
                {item.accountName}
                {item.destinationAccountName
                  ? ` → ${item.destinationAccountName}`
                  : item.categoryName
                    ? ` · ${item.categoryName}`
                    : ""}
              </Text>
              <Text style={[styles.detail, { color: theme.secondaryLabel }]} numberOfLines={1}>
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
          items.length > 0 ? (
            <View style={{ padding: spacing.lg }}>
              {actionError ? <InlineError message={actionError} onRetry={() => setActionError(null)} /> : null}
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
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: "center", gap: spacing.md }}>
            <Text style={{ color: theme.secondaryLabel, textAlign: "center" }}>
              Aucune transaction récurrente.
            </Text>
            <Text style={{ color: theme.secondaryLabel, fontSize: 13, textAlign: "center" }}>
              Utilisez le bouton + en haut pour créer votre première règle.
            </Text>
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
    borderRadius: 16,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: "600",
  },
  detail: {
    fontSize: 13,
  },
  generateButton: {
    alignSelf: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
});
