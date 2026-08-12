import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SelectField } from "@/components/select-field";
import { ActionButton, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { listAccounts } from "@/db/accounts";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { parseMoneyInput } from "@/currency/currencies";
import {
  createRecurring,
  getRecurring,
  updateRecurring,
} from "@/db/recurring";
import { radius, spacing, useTheme } from "@/theme";
import type {
  Account,
  Category,
  Frequency,
  TransactionType,
} from "@/types";
import { formatDate } from "@/utils/format";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "income", label: "Revenu" },
  { value: "expense", label: "Dépense" },
  { value: "transfer", label: "Transfert" },
];

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Tous les jours" },
  { value: "weekly", label: "Toutes les semaines" },
  { value: "monthly", label: "Tous les mois" },
  { value: "yearly", label: "Tous les ans" },
];

export default function RecurringFormScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const recurringId = id ? Number(id) : null;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [fee, setFee] = useState("");
  const [note, setNote] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [intervalValue, setIntervalValue] = useState("1");
  const [startDate, setStartDate] = useState(new Date());
  const [nextDate, setNextDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<"start" | "next" | "end" | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [accs, cats, existing] = await Promise.all([
      listAccounts(db),
      listCategories(db),
      recurringId ? getRecurring(db, recurringId) : Promise.resolve(null),
    ]);
    setAccounts(accs);
    setCategories(cats);
    if (existing) {
      setType(existing.type);
      setAmount(String(existing.amount));
      setAccountId(existing.accountId);
      setDestinationId(existing.destinationAccountId);
      setCategoryId(existing.categoryId);
      setFee(existing.fee ? String(existing.fee) : "");
      setNote(existing.note ?? "");
      setFrequency(existing.frequency);
      setIntervalValue(String(existing.interval));
      setStartDate(new Date(existing.startDate));
      setNextDate(new Date(existing.nextDate));
      setEndDate(existing.endDate ? new Date(existing.endDate) : null);
      setIsActive(existing.isActive);
    }
  }, [recurringId]);

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        setLoadingOptions(true);
        setLoadError(null);
        try {
          await load();
        } catch (error) {
          setLoadError(userMessage(error, "Impossible de charger les comptes."));
          log.error("recurring.load", "Échec du chargement des options", error);
        } finally {
          setLoadingOptions(false);
        }
      };
      void refresh();
    }, [load]),
  );

  const retryLoad = useCallback(() => {
    setLoadingOptions(true);
    setLoadError(null);
    void load()
      .catch((error) => {
        setLoadError(userMessage(error, "Impossible de charger les comptes."));
        log.error("recurring.load", "Échec du rechargement des options", error);
      })
      .finally(() => setLoadingOptions(false));
  }, [load]);

  const accountOptions = useMemo(() => {
    const selectedIds = new Set<number>();
    if (accountId != null) selectedIds.add(accountId);
    if (destinationId != null) selectedIds.add(destinationId);
    return accounts
      .filter((a) => !a.hidden || selectedIds.has(a.id))
      .map((a) => ({ id: a.id, label: `${a.name} · ${a.currencyCode}` }));
  }, [accounts, accountId, destinationId]);

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.type === type)
        .map((c) => ({ id: c.id, label: c.name, icon: c.icon })),
    [categories, type],
  );

  const sourceCurrency = accounts.find((account) => account.id === accountId)?.currencyCode ?? "XOF";

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
    const parsedAmount = parseMoneyInput(amount, sourceCurrency);
    const parsedFee = fee.trim() ? parseMoneyInput(fee, sourceCurrency) : null;
    const parsedInterval = Number(intervalValue);
    if (parsedAmount == null || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Montant invalide", `Saisissez un montant positif en ${sourceCurrency}.`);
      return;
    }
    if (!Number.isInteger(parsedInterval) || parsedInterval <= 0) {
      Alert.alert("Intervalle invalide", "Saisissez un intervalle entier positif.");
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

    const input = {
      type,
      amount: parsedAmount,
      categoryId,
      accountId: accountId!,
      destinationAccountId: type === "transfer" ? destinationId : null,
      fee: type === "transfer" ? parsedFee : null,
      note: note.trim() || null,
      frequency,
      interval: parsedInterval,
      startDate: startDate.getTime(),
      nextDate: nextDate.getTime(),
      endDate: endDate?.getTime() ?? null,
      isActive,
    };

    setSaving(true);
    try {
      const db = await getDatabase();
      if (recurringId) {
        await updateRecurring(db, recurringId, input);
      } else {
        await createRecurring(db, input);
      }
      router.back();
    } catch (e) {
      Alert.alert("Impossible d'enregistrer", userMessage(e));
      log.error("recurring.save", "Échec de l'enregistrement de la récurrence", e);
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: recurringId ? "Modifier la récurrence" : "Nouvelle récurrence",
        }}
      />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {loadError ? <InlineError message={loadError} onRetry={retryLoad} /> : null}
        {loadingOptions ? (
          <View style={styles.loadingRow} accessibilityLiveRegion="polite">
            <ActivityIndicator color={theme.accent} accessibilityLabel="Chargement des comptes" />
            <Text style={{ color: theme.secondaryLabel }}>Préparation du formulaire…</Text>
          </View>
        ) : null}
        <View accessible accessibilityRole="radiogroup" style={styles.typeRow}>
          {TYPES.map((t) => {
            const active = type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => switchType(t.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
                accessibilityHint="Change le type de récurrence."
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
                    color: active ? theme.onAccent : theme.secondaryLabel,
                    fontWeight: "700",
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.amountSection}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Montant de la récurrence
          </Text>
          <View
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.separator,
            borderWidth: StyleSheet.hairlineWidth,
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
            accessibilityLabel={`Montant en ${sourceCurrency}`}
            style={{
              color: theme.label,
              fontSize: 40,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
              textAlign: "center",
              minWidth: 160,
            }}
          />
          <Text style={{ color: theme.secondaryLabel }}>{sourceCurrency}</Text>
          </View>
        </View>

        <SelectField
          label="Compte"
          value={accountOptions.find((o) => o.id === accountId)?.label ?? null}
          options={accountOptions}
          onChange={setAccountId}
        />

        {type === "transfer" ? (
          <>
            <SelectField
              label="Compte de destination"
              value={accountOptions.find((o) => o.id === destinationId)?.label ?? null}
              options={accountOptions}
              onChange={setDestinationId}
            />
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
              accessibilityLabel={`Frais en ${sourceCurrency}, optionnels`}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.separator,
                    color: theme.label,
                  },
                ]}
              />
            </View>
          </>
        ) : (
          <SelectField
            label="Catégorie"
            value={categoryOptions.find((o) => o.id === categoryId)?.label ?? null}
            options={categoryOptions}
            onChange={setCategoryId}
          />
        )}

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <SelectField
              label="Fréquence"
              value={FREQUENCIES.find((f) => f.value === frequency)?.label ?? null}
              options={FREQUENCIES.map((f, index) => ({ id: index + 1, label: f.label }))}
              onChange={(id) => setFrequency(FREQUENCIES[id - 1].value)}
            />
          </View>
          <View style={{ flex: 0.6 }}>
            <View style={{ gap: spacing.xs + 2 }}>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                Intervalle
              </Text>
              <TextInput
                value={intervalValue}
                onChangeText={setIntervalValue}
                placeholder="1"
                placeholderTextColor={theme.secondaryLabel}
                keyboardType="number-pad"
                inputMode="numeric"
                accessibilityLabel="Intervalle de répétition"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.separator,
                    color: theme.label,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Pressable
            onPress={() => setPicking("start")}
            accessibilityRole="button"
            accessibilityLabel={`Date de début ${formatDate(startDate.getTime())}`}
            style={({ pressed }) => [
              styles.dateButton,
              { backgroundColor: theme.surface, borderColor: theme.separator },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Début</Text>
            <Text style={{ color: theme.label, fontWeight: "600" }}>
              {formatDate(startDate.getTime())}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPicking("next")}
            accessibilityRole="button"
            accessibilityLabel={`Prochaine échéance ${formatDate(nextDate.getTime())}`}
            style={({ pressed }) => [
              styles.dateButton,
              { backgroundColor: theme.surface, borderColor: theme.separator },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Prochaine</Text>
            <Text style={{ color: theme.label, fontWeight: "600" }}>
              {formatDate(nextDate.getTime())}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Text style={{ flex: 1, color: theme.label, fontWeight: "600" }}>
            Fin (optionnel)
          </Text>
          {endDate ? (
          <Pressable
            onPress={() => setEndDate(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Retirer la date de fin"
          >
              <Text style={{ color: theme.expense, fontWeight: "600", fontSize: 13 }}>
                Retirer
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setPicking("end")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={endDate ? `Modifier la date de fin ${formatDate(endDate.getTime())}` : "Choisir une date de fin"}
          >
            <Text style={{ color: theme.secondaryLabel, fontWeight: "600", fontSize: 13 }}>
              {endDate ? formatDate(endDate.getTime()) : "Choisir"}
            </Text>
          </Pressable>
        </View>

        {picking !== null ? (
          <DateTimePicker
            mode="date"
            value={
              picking === "start"
                ? startDate
                : picking === "next"
                  ? nextDate
                  : (endDate ?? new Date())
            }
            onValueChange={(_, d) => {
              setPicking(null);
              if (picking === "start") {
                setStartDate(d);
                if (nextDate.getTime() < d.getTime()) {
                  setNextDate(d);
                }
              } else if (picking === "next") {
                setNextDate(d);
              } else {
                setEndDate(d);
              }
            }}
            onDismiss={() => setPicking(null)}
          />
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Text style={{ flex: 1, color: theme.label, fontWeight: "600" }}>
            Récurrence active
          </Text>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            accessibilityLabel="Récurrence active"
            accessibilityState={{ checked: isActive }}
            trackColor={{ true: theme.accent, false: theme.surfaceElevated }}
            thumbColor={theme.accentSurfaceText}
          />
        </View>

        <View style={{ gap: spacing.xs + 2 }}>
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
            Note (optionnel)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={200}
            placeholder="Ex. : loyer"
            placeholderTextColor={theme.secondaryLabel}
            accessibilityLabel="Note optionnelle"
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.separator,
                color: theme.label,
                minHeight: 80,
              },
            ]}
          />
        </View>

        <ActionButton
          onPress={save}
          disabled={saving || loadingOptions}
          label={saving ? "Enregistrement…" : "Enregistrer"}
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 32,
  },
  amountSection: {
    gap: spacing.xs + 2,
  },
  typeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row2: {
    flexDirection: "row",
    gap: spacing.md,
  },
  input: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateButton: {
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    alignItems: "center",
    paddingVertical: spacing.md + 2,
    borderRadius: radius.xl,
    marginTop: spacing.sm,
  },
});
