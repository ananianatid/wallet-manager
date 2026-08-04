import { router, Stack, useFocusEffect } from "expo-router";
import { Plus } from "lucide-react-native";
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
import {
  applyDueRecurring,
  deleteRecurring,
  listRecurring,
} from "@/db/recurring";
import { radius, spacing, useTheme } from "@/theme";
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
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const db = await getDatabase();
    setItems(await listRecurring(db));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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
    try {
      const db = await getDatabase();
      const generated = await applyDueRecurring(db);
      if (generated > 0) {
        Alert.alert(
          "Récurrentes générées",
          `${generated} transaction${generated > 1 ? "s" : ""} créée${generated > 1 ? "s" : ""}.`,
        );
      } else {
        Alert.alert("Aucune échéance", "Aucune transaction récurrente n'est due.");
      }
      await load();
    } catch (e) {
      Alert.alert("Génération impossible", errorMessage(e));
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
            <Pressable
              onPress={() => router.push("/recurring/form")}
              hitSlop={8}
              accessibilityLabel="Ajouter une récurrence"
            >
              <Plus size={22} strokeWidth={2.2} color={theme.accent} />
            </Pressable>
          ),
        }}
      />
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
            <View style={styles.body}>
              <Text style={[styles.title, { color: theme.label }]} numberOfLines={1}>
                {TYPE_LABELS[item.type]} · {formatAmount(item.amount)}
                {item.fee ? ` + frais ${formatAmount(item.fee)}` : ""}
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
            <Pressable
              onPress={() => confirmDelete(item)}
              hitSlop={8}
              accessibilityLabel={`Supprimer ${item.id}`}
            >
              <Text style={{ color: theme.expense, fontSize: 13 }}>Supprimer</Text>
            </Pressable>
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
              <Pressable
                onPress={generateNow}
                disabled={generating}
                style={({ pressed }) => [
                  styles.generateButton,
                  { backgroundColor: theme.accent },
                  (pressed || generating) && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>
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
            <Pressable
              onPress={() => router.push("/recurring/form")}
              style={({ pressed }) => [
                styles.generateButton,
                { backgroundColor: theme.accent },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>
                Créer une récurrence
              </Text>
            </Pressable>
          </View>
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