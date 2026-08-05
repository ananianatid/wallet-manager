import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SelectField } from "@/components/select-field";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { listAccounts } from "@/db/accounts";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { createGoalReservation, listGoals } from "@/db/goals";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/db/transactions";
import { radius, spacing, useTheme } from "@/theme";
import type { Account, Category, Goal, TransactionType } from "@/types";
import { formatDate, formatTime } from "@/utils/format";

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "income", label: "Revenu" },
  { value: "expense", label: "Dépense" },
  { value: "transfer", label: "Transfert" },
];

export default function NewTransactionScreen() {
  const theme = useTheme();
  const { id, goalId: goalParam } = useLocalSearchParams<{
    id?: string;
    goalId?: string;
  }>();
  const transactionId = id ? Number(id) : null;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [goalReservationId, setGoalReservationId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [accs, cats, goalRows, existing] = await Promise.all([
      listAccounts(db),
      listCategories(db),
      listGoals(db),
      transactionId ? getTransaction(db, transactionId) : Promise.resolve(null),
    ]);
    setAccounts(accs);
    setCategories(cats);
    setGoals(goalRows);
    if (existing) {
      setType(existing.type);
      setAmount(String(existing.amount));
      setAccountId(existing.accountId);
      setDestinationId(existing.destinationAccountId);
      setGoalReservationId(null);
      setCategoryId(existing.categoryId);
      setFee(existing.fee ? String(existing.fee) : "");
      setNote(existing.note ?? "");
      setDate(new Date(existing.transactionDate));
    } else if (goalParam) {
      const parsedGoalId = Number(goalParam);
      if (Number.isInteger(parsedGoalId) && parsedGoalId > 0) {
        setType("transfer");
        setGoalReservationId(parsedGoalId);
      }
    }
  }, [goalParam, transactionId]);

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        setLoadingOptions(true);
        setLoadError(null);
        try {
          await load();
        } catch (error) {
          setLoadError(error instanceof Error ? error.message : "Impossible de charger les comptes.");
        } finally {
          setLoadingOptions(false);
        }
      };
      void refresh();
    }, [load]),
  );

  const accountOptions = useMemo(() => {
    const selectedIds = new Set<number>();
    if (accountId != null) selectedIds.add(accountId);
    if (destinationId != null) selectedIds.add(destinationId);
    return accounts
      .filter((a) => !a.hidden || selectedIds.has(a.id))
      .map((a) => ({ id: a.id, label: a.name }));
  }, [accounts, accountId, destinationId]);
  const goalOptions = useMemo(
    () =>
      goals
        .filter((goal) => goal.status === "active")
        .map((goal) => ({ id: goal.id, label: goal.name })),
    [goals],
  );
  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.type === type)
        .map((c) => ({ id: c.id, label: c.name, icon: c.icon })),
    [categories, type],
  );

  const switchType = (t: TransactionType) => {
    setType(t);
    if (t === "transfer") {
      setCategoryId(null);
    } else {
      setDestinationId(null);
      setGoalReservationId(null);
      setFee("");
    }
  };

  const save = async () => {
    setErrors({});
    const parsedAmount = Number(amount);
    const parsedFee = fee.trim() ? Number(fee) : null;
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setErrors({ amount: "Saisissez un montant entier en FCFA." });
      return;
    }
    if (accountId == null) {
      setErrors({ account: "Choisissez un compte." });
      return;
    }
    if (type !== "transfer" && categoryId == null) {
      setErrors({ category: "Choisissez une catégorie." });
      return;
    }
    if (type === "transfer" && destinationId == null && goalReservationId == null) {
      setErrors({
        destination: "Choisissez un compte de destination ou un objectif.",
      });
      return;
    }
    if (parsedFee != null && (!Number.isInteger(parsedFee) || parsedFee <= 0)) {
      setErrors({ fee: "Les frais doivent être un entier positif." });
      return;
    }

    const isGoalReservation = type === "transfer" && goalReservationId != null;
    const destinationAccountId =
      type === "transfer" && destinationId != null ? destinationId : null;
    const input = {
      type,
      amount: parsedAmount,
      categoryId,
      accountId: accountId!,
      destinationAccountId,
      fee: type === "transfer" && !isGoalReservation ? parsedFee : null,
      note: note.trim() || null,
      transactionDate: date.getTime(),
    };

    setSaving(true);
    try {
      const db = await getDatabase();
      if (isGoalReservation) {
        if (transactionId) {
          throw new Error("Une réservation d'objectif ne se modifie pas comme une transaction.");
        }
        await createGoalReservation(db, {
          goalId: goalReservationId!,
          sourceAccountId: accountId!,
          amount: parsedAmount,
          note: note.trim() || null,
          reservationDate: date.getTime(),
        });
      } else if (transactionId) {
        await updateTransaction(db, transactionId, input);
      } else {
        await createTransaction(db, input);
      }
      router.back();
    } catch (e) {
      Alert.alert(
        "Impossible d'enregistrer",
        e instanceof Error ? e.message : "Une erreur est survenue.",
      );
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (transactionId == null) {
      return;
    }
    Alert.alert("Supprimer cette transaction ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          const db = await getDatabase();
          await deleteTransaction(db, transactionId);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: transactionId ? "Modifier la transaction" : "Nouvelle transaction",
          headerRight: transactionId
            ? () => (
                <Pressable onPress={confirmDelete} hitSlop={8}>
                  <Text style={{ color: theme.expense, fontWeight: "600" }}>
                    Supprimer
                  </Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {loadError ? <InlineError message={loadError} onRetry={() => setLoadError(null)} /> : null}
        {loadingOptions ? <ActivityIndicator color={theme.accent} accessibilityLabel="Chargement des comptes" /> : null}
        <View style={styles.typeRow}>
          {TYPES.map((t) => {
            const active = type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => switchType(t.value)}
                style={({ pressed }) => [
                  styles.typeButton,
                  {
                    backgroundColor: active ? theme.accent : theme.surface,
                    borderColor: active ? theme.accent : theme.separator,
                  },
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
              >
                <Text
                  style={{
                    color: active ? "#0A0A0B" : theme.secondaryLabel,
                    fontWeight: "700",
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FormField label="Montant" error={errors.amount}>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.lg,
            alignItems: "center",
            paddingVertical: spacing.sm,
          }}
        >
          <TextInput
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              setErrors((current) => ({ ...current, amount: "" }));
            }}
            placeholder="0"
            placeholderTextColor={theme.secondaryLabel}
            keyboardType="number-pad"
            inputMode="numeric"
            accessibilityLabel="Montant en FCFA"
            style={{
              color: theme.label,
              fontSize: 36,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
              textAlign: "center",
              minWidth: 160,
            }}
          />
          <Text style={{ color: theme.secondaryLabel }}>FCFA</Text>
        </View>
        </FormField>

        <FormField label="Compte" error={errors.account}>
          <SelectField
            label="Compte"
            hideLabel
            value={accountOptions.find((o) => o.id === accountId)?.label ?? null}
            options={accountOptions}
            onChange={(value) => {
              setAccountId(value);
              setErrors((current) => ({ ...current, account: "" }));
            }}
          />
        </FormField>

        {type === "transfer" ? (
          <>
            <FormField label="Compte de destination" error={errors.destination}>
              <SelectField
                label="Compte de destination"
                hideLabel
                value={accountOptions.find((o) => o.id === destinationId)?.label ?? null}
                options={accountOptions}
                onChange={(id) => {
                  setDestinationId(id);
                  setGoalReservationId(null);
                  setErrors((current) => ({ ...current, destination: "" }));
                }}
              />
            </FormField>
            <FormField label="Réserver vers un objectif (optionnel)">
              <SelectField
                label="Objectif à réserver"
                hideLabel
                value={
                  goalOptions.find((o) => o.id === goalReservationId)?.label ??
                  (goalOptions.length === 0 ? "Aucun objectif actif" : null)
                }
                options={goalOptions}
                onChange={(id) => {
                  setGoalReservationId(id);
                  setDestinationId(null);
                  setErrors((current) => ({ ...current, destination: "" }));
                }}
              />
            </FormField>
          </>
        ) : (
          <FormField label="Catégorie" error={errors.category}>
            <SelectField
              label="Catégorie"
              hideLabel
              value={categoryOptions.find((o) => o.id === categoryId)?.label ?? null}
              options={categoryOptions}
              onChange={(value) => {
                setCategoryId(value);
                setErrors((current) => ({ ...current, category: "" }));
              }}
            />
          </FormField>
        )}

        {type === "transfer" && goalReservationId == null ? (
          <FormField label="Frais (optionnel)" error={errors.fee}>
            <TextInput
              value={fee}
              onChangeText={(value) => {
                setFee(value);
                setErrors((current) => ({ ...current, fee: "" }));
              }}
              placeholder="0"
              placeholderTextColor={theme.secondaryLabel}
              keyboardType="number-pad"
              inputMode="numeric"
              accessibilityLabel="Frais en FCFA, optionnels"
              style={[
                styles.input,
                { backgroundColor: theme.surface, color: theme.label },
              ]}
            />
          </FormField>
        ) : null}

        {type === "transfer" && goalReservationId != null ? (
          <View
            style={{
              backgroundColor: theme.surfaceElevated,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.xs,
            }}
          >
            <Text style={{ color: theme.label, fontWeight: "700" }}>
              Réservation virtuelle
            </Text>
            <Text style={{ color: theme.secondaryLabel, fontSize: 13, lineHeight: 18 }}>
              Le solde total ne bouge pas. Cette somme sera réservée à l&apos;objectif et retirée du solde disponible.
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Date ${formatDate(date.getTime())}`}
            style={({ pressed }) => [
              styles.dateButton,
              { backgroundColor: theme.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Date</Text>
            <Text style={{ color: theme.label, fontWeight: "600" }}>
              {formatDate(date.getTime())}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowTimePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Heure ${formatTime(date.getTime())}`}
            style={({ pressed }) => [
              styles.dateButton,
              { backgroundColor: theme.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Heure</Text>
            <Text style={{ color: theme.label, fontWeight: "600" }}>
              {formatTime(date.getTime())}
            </Text>
          </Pressable>
        </View>

        {showDatePicker ? (
          <DateTimePicker
            mode="date"
            value={date}
            onValueChange={(_, d) => {
              setShowDatePicker(false);
              setDate(d);
            }}
            onDismiss={() => setShowDatePicker(false)}
          />
        ) : null}
        {showTimePicker ? (
          <DateTimePicker
            mode="time"
            value={date}
            onValueChange={(_, d) => {
              setShowTimePicker(false);
              setDate(d);
            }}
            onDismiss={() => setShowTimePicker(false)}
          />
        ) : null}

        <FormField label="Note (optionnel)">
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Ex. : courses du marché"
            placeholderTextColor={theme.secondaryLabel}
            multiline
            accessibilityLabel="Note optionnelle"
            style={[
              styles.input,
              { backgroundColor: theme.surface, color: theme.label, minHeight: 80 },
            ]}
          />
        </FormField>

        <ActionButton
          onPress={save}
          disabled={saving || loadingOptions}
          label={
            saving
              ? "Enregistrement…"
              : type === "transfer" && destinationId != null && destinationId < 0
                ? "Réserver pour l'objectif"
                : "Enregistrer"
          }
        />
      </KeyboardAwareScreen>
    </>
  );
}

const styles = StyleSheet.create({
  typeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
  },
  dateButton: {
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  saveButton: {
    alignItems: "center",
    paddingVertical: spacing.md + 2,
    borderRadius: radius.xl,
    marginTop: spacing.sm,
  },
  saveLabel: {
    color: "#0A0A0B",
    fontWeight: "700",
    fontSize: 16,
  },
});
