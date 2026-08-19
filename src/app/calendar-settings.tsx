import { Check } from "lucide-react-native";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getDatabase } from "@/db/database";
import { getSetting, setSetting } from "@/db/settings";
import { InlineError, ScreenState } from "@/components/ui";
import { radius, spacing, typography, useTheme } from "@/theme";
import {
  DEFAULT_WEEK_START_DAY,
  parseWeekStartDay,
  type WeekStartDay,
} from "@/utils/statistics";

const WEEK_DAYS: { value: WeekStartDay; label: string }[] = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

export default function CalendarSettingsScreen() {
  const theme = useTheme();
  const [weekStartDay, setWeekStartDay] = useState<WeekStartDay>(
    DEFAULT_WEEK_START_DAY,
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    const db = await getDatabase();
    const value = await getSetting(db, "week_start_day");
    setWeekStartDay(parseWeekStartDay(value));
    setStatus("ready");
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getDatabase()
        .then((db) => getSetting(db, "week_start_day"))
        .then((value) => {
          if (!cancelled) {
            setError(null);
            setWeekStartDay(parseWeekStartDay(value));
            setStatus("ready");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Le réglage du calendrier n’a pas pu être chargé.");
            setStatus("error");
          }
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const selectWeekStart = async (next: WeekStartDay) => {
    const previous = weekStartDay;
    setError(null);
    setWeekStartDay(next);
    try {
      const db = await getDatabase();
      await setSetting(db, "week_start_day", String(next));
    } catch {
      setWeekStartDay(previous);
      setError("Le premier jour de la semaine n’a pas pu être enregistré.");
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Calendrier" }} />
      {status === "loading" || status === "error" ? (
        <ScreenState
          status={status}
          message={error ?? undefined}
          onRetry={() => void load().catch(() => setStatus("error"))}
        />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
        >
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.label }]}>
              Début de la semaine
            </Text>
            <Text style={{ color: theme.secondaryLabel, lineHeight: 19 }}>
              Ce choix sert à définir les périodes hebdomadaires dans Statistiques.
              La semaine commence à 00:00 le jour choisi.
            </Text>
            {error ? <InlineError message={error} /> : null}
          </View>

          <View style={[styles.section, { backgroundColor: theme.surface }]}> 
            {WEEK_DAYS.map((day, index) => (
              <View key={day.value}>
                {index > 0 ? (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: theme.separator,
                      marginLeft: spacing.lg,
                    }}
                  />
                ) : null}
                <Pressable
                  onPress={() => void selectWeekStart(day.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={day.label}
                  accessibilityState={{ selected: weekStartDay === day.value }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={{ color: theme.label, fontWeight: "600", flex: 1 }}>
                    {day.label}
                  </Text>
                  {weekStartDay === day.value ? (
                    <Check size={19} strokeWidth={2.5} color={theme.accent} />
                  ) : null}
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  section: {
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  title: typography.title,
});
