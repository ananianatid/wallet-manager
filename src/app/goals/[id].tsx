import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { ArrowUpRight, Calendar, Check, RotateCcw, Target, Trash2, Undo2 } from "lucide-react-native";
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
import { IconButton, InlineError, ScreenState } from "@/components/ui";
import { useAsyncResource } from "@/hooks/use-async-resource";
import {
  closeGoal,
  deleteGoal,
  getGoal,
  listGoalReservations,
  releaseGoalReservation,
} from "@/db/goals";
import { radius, spacing, useTheme } from "@/theme";
import type { GoalReservation } from "@/types";
import { formatAmount, formatDate } from "@/utils/format";

export default function GoalDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goalId = Number(id);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [nextGoal, rows] = await Promise.all([
      getGoal(db, goalId),
      listGoalReservations(db, goalId),
    ]);
    return { goal: nextGoal, reservations: rows };
  }, [goalId]);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const goal = resource.data?.goal ?? null;
  const reservations = resource.data?.reservations ?? [];

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const release = (reservation: GoalReservation) => {
    Alert.alert(
      "Libérer cette réservation ?",
      `${formatAmount(reservation.amount)} redeviendra disponible sur ${reservation.sourceAccountName}.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Libérer",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await releaseGoalReservation(db, reservation.id);
              await resource.reload();
            } catch (error) {
              setActionError(error instanceof Error ? error.message : "Impossible de libérer la réservation.");
            }
          },
        },
      ],
    );
  };

  const close = () => {
    if (!goal) return;
    Alert.alert("Clôturer cet objectif ?", "Les réservations restent conservées.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Clôturer",
        onPress: async () => {
          try {
            const db = await getDatabase();
            await closeGoal(db, goal.id);
            await resource.reload();
          } catch (error) {
            setActionError(error instanceof Error ? error.message : "Impossible de clôturer l'objectif.");
          }
        },
      },
    ]);
  };

  const remove = () => {
    if (!goal) return;
    Alert.alert("Supprimer cet objectif ?", "Libérez d'abord ses réservations. L'historique sera supprimé.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            const db = await getDatabase();
            await deleteGoal(db, goal.id);
            router.back();
          } catch (e) {
            Alert.alert("Suppression impossible", e instanceof Error ? e.message : "Une erreur est survenue.");
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: goal?.name ?? "Objectif",
          headerRight: () =>
            goal ? (
              <Pressable onPress={remove} hitSlop={8} accessibilityLabel="Supprimer l'objectif">
                <Trash2 size={19} strokeWidth={2.1} color={theme.expense} />
              </Pressable>
            ) : null,
        }}
      />
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={resource.error?.message}
          onRetry={() => void resource.reload()}
        />
      ) : !goal ? (
        <ScreenState status="error" message="Cet objectif est introuvable." />
      ) : (
      <FlatList
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 }}
        data={reservations}
        keyExtractor={(reservation) => String(reservation.id)}
        renderItem={({ item }) => (
          <View style={[styles.historyRow, { backgroundColor: theme.surface }]}>
            <View style={[styles.historyIcon, { backgroundColor: theme.surfaceElevated }]}>
              {item.releasedAt ? (
                <RotateCcw size={16} strokeWidth={2.2} color={theme.secondaryLabel} />
              ) : (
                <ArrowUpRight size={16} strokeWidth={2.2} color={theme.accent} />
              )}
            </View>
            <View style={styles.historyBody}>
              <Text style={{ color: theme.label, fontWeight: "600" }}>
                {item.releasedAt ? "Réservation libérée" : "Réservation"}
              </Text>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                {formatDate(item.reservationDate)} · {item.sourceAccountName}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
              <Text style={{ color: item.releasedAt ? theme.secondaryLabel : theme.label, fontWeight: "800" }}>
                {formatAmount(item.amount)}
              </Text>
              {!item.releasedAt ? (
                <IconButton
                  label="Libérer cette réservation"
                  onPress={() => release(item)}
                  icon={<Undo2 size={16} color={theme.expense} strokeWidth={2.2} />}
                />
              ) : null}
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          goal ? (
            <View style={{ gap: spacing.md }}>
              {actionError ? <InlineError message={actionError} onRetry={() => setActionError(null)} /> : null}
              <View style={[styles.hero, { backgroundColor: theme.surface }]}>
                <View style={styles.heroTitle}>
                  <View style={[styles.heroIcon, { backgroundColor: theme.surfaceElevated }]}>
                    {goal.isAchieved ? <Check size={20} color={theme.income} /> : <Target size={20} color={theme.accent} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: theme.label, fontSize: 18, fontWeight: "800" }}>{goal.name}</Text>
                    <Text style={{ color: theme.secondaryLabel }}>Cible le {formatDate(goal.targetDate)}</Text>
                  </View>
                  <Text style={{ color: goal.isOverdue ? theme.expense : theme.accent, fontWeight: "800" }}>
                    {goal.isAchieved ? "100%" : `${goal.progressPercent}%`}
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
                  <View style={[styles.progressFill, { backgroundColor: goal.isOverdue ? theme.expense : theme.accent, width: `${goal.progressPercent}%` }]} />
                </View>
                <View style={styles.metrics}>
                  <View>
                    <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Réservé</Text>
                    <Text style={{ color: theme.label, fontSize: 20, fontWeight: "800" }}>{formatAmount(goal.reservedAmount)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Reste</Text>
                    <Text style={{ color: theme.label, fontSize: 20, fontWeight: "800" }}>{formatAmount(goal.remainingAmount)}</Text>
                  </View>
                </View>
                {!goal.isAchieved ? (
                  <Text style={{ color: goal.isOverdue ? theme.expense : theme.secondaryLabel }}>
                    {goal.isOverdue ? "Objectif en retard" : `Rythme recommandé : ${formatAmount(goal.monthlyRequired)} par mois`}
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={() => router.push({ pathname: "/new-transaction", params: { goalId: String(goal.id) } })}
                disabled={goal.status !== "active"}
                style={({ pressed }) => [styles.reserveButton, { backgroundColor: theme.accent }, goal.status !== "active" && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}
              >
                <ArrowUpRight size={18} color="#0A0A0B" strokeWidth={2.4} />
                <Text style={{ color: "#0A0A0B", fontWeight: "800" }}>Réserver une somme</Text>
              </Pressable>

              <View style={styles.actionsRow}>
                {goal.status === "active" ? (
                  <Pressable onPress={close} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.separator }, pressed && { opacity: 0.7 }]}>
                    <Calendar size={15} color={theme.secondaryLabel} />
                    <Text style={{ color: theme.secondaryLabel, fontWeight: "600" }}>Clôturer</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={{ color: theme.secondaryLabel, fontSize: 13, fontWeight: "700", letterSpacing: 1.1 }}>
                HISTORIQUE DES RÉSERVATIONS
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          goal ? (
            <View style={{ paddingVertical: spacing.xl, alignItems: "center", gap: spacing.sm }}>
              <Text style={{ color: theme.secondaryLabel }}>Aucune réservation pour le moment.</Text>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13, textAlign: "center" }}>
                Utilisez « Réserver une somme » pour commencer.
              </Text>
            </View>
          ) : null
        }
      />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  heroTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  metrics: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reserveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.xl,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  historyIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  historyBody: {
    flex: 1,
    gap: 2,
  },
});
