import { router, useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { Check, Plus, Target } from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "@/components/empty-state";
import { IconButton, ScreenState } from "@/components/ui";
import { getDatabase } from "@/db/database";
import { listGoals } from "@/db/goals";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import type { Goal } from "@/types";
import { formatAmount, formatDate } from "@/utils/format";

function GoalCard({ goal, onPress }: { goal: Goal; onPress: () => void }) {
  const theme = useTheme();
  const status = goal.isAchieved
    ? "Atteint"
    : goal.isOverdue
      ? "En retard"
      : `${goal.progressPercent}%`;
  const statusColor = goal.isAchieved
    ? theme.income
    : goal.isOverdue
      ? theme.expense
      : theme.accent;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.icon, { backgroundColor: theme.surfaceElevated }]}>
          {goal.isAchieved ? (
            <Check size={18} strokeWidth={2.4} color={theme.income} />
          ) : (
            <Target size={18} strokeWidth={2.2} color={theme.accent} />
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.title, { color: theme.label }]} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Cible le {formatDate(goal.targetDate)}
          </Text>
        </View>
        <Text style={{ color: statusColor, fontWeight: "800" }}>{status}</Text>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
        <View
          style={[styles.progressFill, { backgroundColor: statusColor, width: `${goal.progressPercent}%` }]}
        />
      </View>

      <View style={styles.cardBottom}>
        <View>
          <Text style={{ color: theme.label, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
            {formatAmount(goal.reservedAmount)}
          </Text>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            sur {formatAmount(goal.targetAmount)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            {goal.isAchieved ? "Objectif atteint" : `Rythme : ${formatAmount(goal.monthlyRequired)}/mois`}
          </Text>
          {!goal.isAchieved ? (
            <Text style={{ color: theme.label, fontWeight: "600" }}>
              Reste {formatAmount(goal.remainingAmount)}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function GoalsScreen() {
  const theme = useTheme();
  const load = useCallback(async () => {
    const db = await getDatabase();
    return listGoals(db);
  }, []);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const goals = resource.data;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Objectifs",
          headerRight: () => (
            <IconButton
              onPress={() => router.push("/goals/new")}
              label="Créer un objectif"
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
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 }}
      >
        <View style={[styles.intro, { backgroundColor: theme.surfaceElevated }]}>
          <Text style={{ color: theme.label, fontSize: 17, fontWeight: "800" }}>
            Donnez une destination à votre argent.
          </Text>
          <Text style={{ color: theme.secondaryLabel, lineHeight: 19 }}>
            Réservez une somme depuis n&apos;importe quel compte. Votre solde total reste vrai, votre solde disponible devient honnête.
          </Text>
        </View>

        {goals?.length === 0 ? (
          <EmptyState
            title="Aucun objectif"
            message="Créez une première cible, comme une PS5, un voyage ou un fonds de sécurité."
            actionLabel="Créer un objectif"
            onAction={() => router.push("/goals/new")}
          />
        ) : null}

        {goals?.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onPress={() => router.push({ pathname: "/goals/[id]", params: { id: String(goal.id) } })}
          />
        ))}
      </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
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
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
});
