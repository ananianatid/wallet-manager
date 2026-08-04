import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SelectField } from "@/components/select-field";
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
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setCategoryId(existing.categoryId);
      setFee(existing.fee ? String(existing.fee) : "");
      setNote(existing.note ?? "");
      setDate(new Date(existing.transactionDate));
    } else if (goalParam) {
      const parsedGoalId = Number(goalParam);
      if (Number.isInteger(parsedGoalId) && parsedGoalId > 0) {
        setType("transfer");
        setDestinationId(-parsedGoalId);
      }
    }
  }, [goalParam, transactionId]);

  useFocusEffect(
    useCallback(() => {
      load();
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
  const destinationOptions = useMemo(
    () => [
      ...accountOptions,
      ...goals
        .filter((goal) => goal.status === "active")
        .map((goal) => ({ id: -goal.id, label: `${goal.name} · Objectif` })),
    ],
    [accountOptions, goals],
  );
  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.type === type)
        .map((c) => ({ id: c.id, label: c.name })),
    [categories, type],
  );

  const switchType = (t: TransactionType) => {
    setType(t);
    if (t === "transfer") {
      setCategoryId(null);
    } else {
      setDestinationId(null);
      setFee("");
    }
  };

  const save = async () => {
    const parsedAmount = Number(amount);
    const parsedFee = fee.trim() ? Number(fee) : null;
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Montant invalide", "Saisissez un montant entier en FCFA.");
      return;
    }
    if (accountId == null) {
      Alert.alert("Compte manquant", "Choisissez un compte.");
      return;
    }
    if (type !== "transfer" && categoryId == null) {
      Alert.alert("Catégorie manquante", "Choisissez une catégorie.");
      return;
    }
    if (type === "transfer" && destinationId == null) {
      Alert.alert("Destination manquante", "Choisissez le compte de destination.");
      return;
    }
    if (parsedFee != null && (!Number.isInteger(parsedFee) || parsedFee <= 0)) {
      Alert.alert("Frais invalide", "Les frais doivent être un entier positif.");
      return;
    }

    const isGoalReservation = type === "transfer" && destinationId != null && destinationId < 0;
    const destinationAccountId =
      type === "transfer" && destinationId != null && destinationId > 0
        ? destinationId
        : null;
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
          goalId: -destinationId!,
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
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
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

        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.lg,
            alignItems: "center",
            paddingVertical: spacing.lg,
          }}
        >
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={theme.secondaryLabel}
            keyboardType="number-pad"
            inputMode="numeric"
            style={{
              color: theme.label,
              fontSize: 40,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
              textAlign: "center",
              minWidth: 160,
            }}
          />
          <Text style={{ color: theme.secondaryLabel }}>FCFA</Text>
        </View>

        <SelectField
          label="Compte"
          value={accountOptions.find((o) => o.id === accountId)?.label ?? null}
          options={accountOptions}
          onChange={setAccountId}
        />

        {type === "transfer" ? (
          <SelectField
            label="Destination"
            value={destinationOptions.find((o) => o.id === destinationId)?.label ?? null}
            options={destinationOptions}
            onChange={(id) => setDestinationId(id)}
          />
        ) : (
          <SelectField
            label="Catégorie"
            value={categoryOptions.find((o) => o.id === categoryId)?.label ?? null}
            options={categoryOptions}
            onChange={setCategoryId}
          />
        )}

        {type === "transfer" && !(destinationId != null && destinationId < 0) ? (
          <View style={{ gap: spacing.xs + 2 }}>
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
              Frais (optionnel)
            </Text>
            <TextInput
              value={fee}
              onChangeText={setFee}
              placeholder="0"
              placeholderTextColor={theme.secondaryLabel}
              keyboardType="number-pad"
              inputMode="numeric"
              style={[
                styles.input,
                { backgroundColor: theme.surface, color: theme.label },
              ]}
            />
          </View>
        ) : null}

        {type === "transfer" && destinationId != null && destinationId < 0 ? (
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

        <View style={{ gap: spacing.xs + 2 }}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Note (optionnel)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Ex. : courses du marché"
            placeholderTextColor={theme.secondaryLabel}
            multiline
            style={[
              styles.input,
              { backgroundColor: theme.surface, color: theme.label, minHeight: 80 },
            ]}
          />
        </View>

        <Pressable
          onPress={save}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.accent },
            (pressed || saving) && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.saveLabel}>
            {saving
              ? "Enregistrement…"
              : type === "transfer" && destinationId != null && destinationId < 0
                ? "Réserver pour l'objectif"
                : "Enregistrer"}
          </Text>
        </Pressable>
      </ScrollView>
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
