import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SelectField } from "@/components/select-field";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { listAccountsByUsage } from "@/db/accounts";
import { listCategoriesByUsage } from "@/db/categories";
import { getDatabase } from "@/db/database";
import { calculateRateFromMinor, currencyDigits, parseMoneyInput } from "@/currency/currencies";
import { getRateForPair } from "@/currency/service";
import { createGoalReservation, listGoals } from "@/db/goals";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/db/transactions";
import { radius, spacing, useTheme } from "@/theme";
import type { Account, Category, Goal, TransactionType } from "@/types";
import { formatAmount, formatDate, formatTime } from "@/utils/format";
import { calculateTransferFee } from "@/utils/transfer-fees";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "income", label: "Revenu" },
  { value: "expense", label: "Dépense" },
  { value: "transfer", label: "Transfert" },
];

type TransferFeeMode = "manual" | "calculated";

const FEE_MODES: { value: TransferFeeMode; label: string }[] = [
  { value: "manual", label: "Frais connu" },
  { value: "calculated", label: "Calcul automatique" },
];

export default function NewTransactionScreen() {
  const theme = useTheme();
  const { id, goalId: goalParam, type: typeParam } = useLocalSearchParams<{
    id?: string;
    goalId?: string;
    type?: TransactionType;
  }>();
  const transactionId = id ? Number(id) : null;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [destinationAmount, setDestinationAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateDate, setExchangeRateDate] = useState<string | null>(null);
  const [exchangeRateProvider, setExchangeRateProvider] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [destinationEdited, setDestinationEdited] = useState(false);
  const [preserveStoredConversion, setPreserveStoredConversion] = useState(false);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [goalReservationId, setGoalReservationId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [fee, setFee] = useState("");
  const [feeMode, setFeeMode] = useState<TransferFeeMode>("manual");
  const [debitedAmount, setDebitedAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [accs, cats, goalRows, existing] = await Promise.all([
      listAccountsByUsage(db),
      listCategoriesByUsage(db),
      listGoals(db),
      transactionId ? getTransaction(db, transactionId) : Promise.resolve(null),
    ]);
    setAccounts(accs);
    if (!existing && accs.length === 1) {
      setAccountId(accs[0].id);
    }
    setCategories(cats);
    setGoals(goalRows);
    if (existing) {
      setType(existing.type);
      setAccountId(existing.accountId);
      setDestinationId(existing.destinationAccountId);
      const sourceAccount = accs.find((account) => account.id === existing.accountId);
      const destinationAccount = accs.find((account) => account.id === existing.destinationAccountId);
      setAmount(
        sourceAccount
          ? (existing.amount / 10 ** currencyDigits(sourceAccount.currencyCode)).toString()
          : String(existing.amount),
      );
      setDestinationAmount(
        existing.destinationAmount == null || !destinationAccount
          ? ""
          : (existing.destinationAmount / 10 ** currencyDigits(destinationAccount.currencyCode)).toString(),
      );
      setExchangeRate(existing.exchangeRate ?? null);
      setExchangeRateDate(existing.exchangeRateDate ?? null);
      setExchangeRateProvider(existing.exchangeRateProvider ?? null);
      setDestinationEdited(false);
      setPreserveStoredConversion(existing.type === "transfer" && existing.exchangeRate != null);
      setGoalReservationId(null);
      setCategoryId(existing.categoryId);
      setFee(existing.fee ? String(existing.fee) : "");
      setFeeMode("manual");
      setDebitedAmount("");
      setNote(existing.note ?? "");
      setDate(new Date(existing.transactionDate));
    } else if (typeParam === "income" || typeParam === "expense" || typeParam === "transfer") {
      setType(typeParam);
    } else if (goalParam) {
      const parsedGoalId = Number(goalParam);
      if (Number.isInteger(parsedGoalId) && parsedGoalId > 0) {
        setType("transfer");
        setGoalReservationId(parsedGoalId);
      }
    }
  }, [goalParam, transactionId, typeParam]);

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        setLoadingOptions(true);
        setLoadError(null);
        try {
          await load();
        } catch (error) {
          setLoadError(userMessage(error, "Impossible de charger les comptes."));
          log.error("transaction.load", "Échec du chargement du formulaire", error);
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
        log.error("transaction.load", "Échec du rechargement du formulaire", error);
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

  const sourceAccount = accounts.find((account) => account.id === accountId) ?? null;
  const destinationAccount = accounts.find((account) => account.id === destinationId) ?? null;
  const sourceCurrency = sourceAccount?.currencyCode ?? "XOF";
  const destinationCurrency = destinationAccount?.currencyCode ?? sourceCurrency;
  const isCrossCurrency =
    type === "transfer" &&
    destinationId != null &&
    sourceCurrency !== destinationCurrency;

  useEffect(() => {
    if (!isCrossCurrency || destinationEdited || preserveStoredConversion || !accountId || !destinationId) return;
    const sourceAmount = parseMoneyInput(amount, sourceCurrency);
    if (sourceAmount == null || Number.isNaN(sourceAmount) || sourceAmount <= 0) {
      return;
    }
    const controller = new AbortController();
    void getDatabase()
      .then((db) => getRateForPair(db, sourceCurrency, destinationCurrency, { signal: controller.signal }))
      .then((rate) => {
        if (!rate) {
          setDestinationAmount("");
          setExchangeRate(null);
          setExchangeRateDate(null);
          setExchangeRateProvider(null);
          setRateError(`Équivalent indisponible : aucun taux ${sourceCurrency}/${destinationCurrency} n’est disponible.`);
          return;
        }
        const target = Math.round(
          (sourceAmount / 10 ** currencyDigits(sourceCurrency)) *
            rate.rate *
            10 ** currencyDigits(destinationCurrency),
        );
        setDestinationAmount(
          (target / 10 ** currencyDigits(destinationCurrency)).toString(),
        );
        setExchangeRate(rate.rate);
        setExchangeRateDate(rate.date);
        setExchangeRateProvider(rate.provider);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRateError(`Équivalent indisponible : aucun taux ${sourceCurrency}/${destinationCurrency} n’est disponible.`);
        }
      });
    return () => controller.abort();
  }, [accountId, amount, destinationCurrency, destinationEdited, destinationId, isCrossCurrency, preserveStoredConversion, sourceCurrency]);

  const switchType = (t: TransactionType) => {
    setType(t);
    if (t === "transfer") {
      setCategoryId(null);
    } else {
      setDestinationId(null);
      setGoalReservationId(null);
      setFee("");
      setFeeMode("manual");
      setDebitedAmount("");
      setDestinationAmount("");
      setExchangeRate(null);
      setExchangeRateDate(null);
      setExchangeRateProvider(null);
      setRateError(null);
      setDestinationEdited(false);
    }
  };

  const switchFeeMode = (mode: TransferFeeMode) => {
    if (mode === feeMode) {
      return;
    }

    const parsedAmount = Number(amount);
    const parsedFee = Number(fee);
    const parsedDebitedAmount = Number(debitedAmount);

    if (mode === "calculated") {
      if (
        Number.isInteger(parsedAmount) &&
        parsedAmount > 0 &&
        (!fee.trim() || (Number.isInteger(parsedFee) && parsedFee >= 0))
      ) {
        setDebitedAmount(String(parsedAmount + (fee.trim() ? parsedFee : 0)));
      }
    } else if (
      Number.isInteger(parsedAmount) &&
      parsedAmount > 0 &&
      Number.isInteger(parsedDebitedAmount) &&
      parsedDebitedAmount >= parsedAmount
    ) {
      const computedFee = parsedDebitedAmount - parsedAmount;
      setFee(computedFee > 0 ? String(computedFee) : "");
    }

    setFeeMode(mode);
    setErrors((current) => ({ ...current, fee: "", debitedAmount: "" }));
  };

  const calculatedFeePreview = useMemo(() => {
    if (feeMode !== "calculated") {
      return null;
    }

    const parsedAmount = parseMoneyInput(amount, sourceCurrency);
    const parsedDebitedAmount = parseMoneyInput(debitedAmount, sourceCurrency);
    if (
      parsedAmount == null ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0 ||
      parsedDebitedAmount == null ||
      Number.isNaN(parsedDebitedAmount) ||
      parsedDebitedAmount < parsedAmount
    ) {
      return null;
    }

    return parsedDebitedAmount - parsedAmount;
  }, [amount, debitedAmount, feeMode, sourceCurrency]);

  const save = async () => {
    setErrors({});
    const parsedAmount = parseMoneyInput(amount, sourceCurrency);
    let parsedFee: number | null = fee.trim() ? parseMoneyInput(fee, sourceCurrency) : null;
    if (parsedAmount == null || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrors({ amount: `Saisissez un montant valide en ${sourceCurrency}.` });
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
    if (
      type === "transfer" &&
      goalReservationId == null &&
      feeMode === "calculated"
    ) {
      const parsedDebitedAmount = parseMoneyInput(debitedAmount, sourceCurrency);
      try {
        if (parsedDebitedAmount == null || Number.isNaN(parsedDebitedAmount)) {
          throw new Error(`Saisissez le total débité en ${sourceCurrency}.`);
        }
        const computedFee = calculateTransferFee(parsedDebitedAmount, parsedAmount);
        parsedFee = computedFee > 0 ? computedFee : null;
      } catch (error) {
        setErrors({
          debitedAmount:
            error instanceof Error && /Saisissez|positif/.test(error.message)
              ? error.message
              : "Le total débité est invalide.",
        });
        return;
      }
    }

    let parsedDestinationAmount: number | null = null;
    let savedExchangeRate: number | null = null;
    let savedExchangeRateDate: string | null = null;
    let savedExchangeRateProvider: string | null = null;
    if (type === "transfer" && destinationId != null) {
      parsedDestinationAmount = isCrossCurrency
        ? parseMoneyInput(destinationAmount, destinationCurrency)
        : parsedAmount;
      if (
        parsedDestinationAmount == null ||
        Number.isNaN(parsedDestinationAmount) ||
        parsedDestinationAmount <= 0
      ) {
        setErrors({ destinationAmount: `Saisissez le montant crédité en ${destinationCurrency}.` });
        return;
      }
      savedExchangeRate = isCrossCurrency
        ? destinationEdited
          ? calculateRateFromMinor(
              parsedAmount,
              sourceCurrency,
              parsedDestinationAmount,
              destinationCurrency,
            )
          : exchangeRate
        : 1;
      savedExchangeRateDate = isCrossCurrency
        ? destinationEdited
          ? new Date().toISOString().slice(0, 10)
          : exchangeRateDate
        : new Date().toISOString().slice(0, 10);
      savedExchangeRateProvider = isCrossCurrency
        ? destinationEdited
          ? "manual"
          : exchangeRateProvider
        : "same currency";
      if (!savedExchangeRate || !savedExchangeRateDate || !savedExchangeRateProvider) {
        setErrors({ destinationAmount: "Le taux de change est indisponible. Actualisez ou saisissez un montant." });
        return;
      }
    }
    if (
      type === "transfer" &&
      goalReservationId == null &&
      feeMode === "manual" &&
      parsedFee != null &&
      (!Number.isInteger(parsedFee) || parsedFee <= 0)
    ) {
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
      destinationAmount: isGoalReservation ? null : parsedDestinationAmount,
      exchangeRate: isGoalReservation ? null : savedExchangeRate,
      exchangeRateDate: isGoalReservation ? null : savedExchangeRateDate,
      exchangeRateProvider: isGoalReservation ? null : savedExchangeRateProvider,
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
      if (transactionId == null && !isGoalReservation) {
        setAmount("");
        setDestinationAmount("");
        setDestinationEdited(false);
        setPreserveStoredConversion(false);
        setCategoryId(null);
        setFee("");
        setDebitedAmount("");
        setNote("");
        setDate(new Date());
        setErrors({});
        setSaveNotice("Transaction enregistrée. Vous pouvez en ajouter une autre.");
        setSaving(false);
        return;
      }
      router.back();
    } catch (e) {
      log.error("transaction.save", "Échec de l'enregistrement de la transaction", e);
      Alert.alert("Impossible d'enregistrer", userMessage(e));
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
                <Pressable
                  onPress={confirmDelete}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer la transaction"
                  accessibilityHint="Demande une confirmation avant la suppression."
                >
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
        {saveNotice ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.saveNotice, { backgroundColor: theme.surfaceElevated }]}
          >
            <Text style={{ color: theme.income, fontWeight: "600" }}>{saveNotice}</Text>
          </View>
        ) : null}
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
            const semanticColor =
              t.value === "income"
                ? theme.income
                : t.value === "expense"
                  ? theme.expense
                  : theme.accent;
            const Icon =
              t.value === "income"
                ? ArrowUpRight
                : t.value === "expense"
                  ? ArrowDownLeft
                  : ArrowLeftRight;
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
                accessibilityHint="Change le type de transaction."
                >
                  <Icon
                    size={17}
                    strokeWidth={2.4}
                    color={active ? theme.onAccent : semanticColor}
                  />
                  <Text
                  style={{
                    color: active ? theme.onAccent : theme.secondaryLabel,
                    fontWeight: "600",
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FormField
          label={type === "transfer" ? `Montant débité (${sourceCurrency})` : `Montant (${sourceCurrency})`}
          error={errors.amount}
        >
        <View
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.separator,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.md,
            borderCurve: "continuous",
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
          }}
        >
          <TextInput
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              setRateError(null);
              setErrors((current) => ({ ...current, amount: "" }));
            }}
            placeholder="0"
            placeholderTextColor={theme.secondaryLabel}
            keyboardType="decimal-pad"
            inputMode="decimal"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            accessibilityLabel={`${type === "transfer" ? "Montant débité" : "Montant"} en ${sourceCurrency}`}
            style={{
              color: theme.label,
              fontSize: 24,
              fontWeight: "600",
              fontVariant: ["tabular-nums"],
              textAlign: "left",
              flex: 1,
            }}
          />
          <Text style={{ color: theme.secondaryLabel }}>{sourceCurrency}</Text>
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
                  setDestinationEdited(false);
                  setPreserveStoredConversion(false);
                  setRateError(null);
                  setGoalReservationId(null);
                  setFeeMode("manual");
                  setDebitedAmount("");
                  setErrors((current) => ({ ...current, destination: "" }));
                }}
              />
            </FormField>
            {destinationId != null ? (
              <FormField label={`Montant crédité (${destinationCurrency})`} error={errors.destinationAmount}>
                <View style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.separator,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: radius.md,
                  borderCurve: "continuous",
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingHorizontal: spacing.lg,
                }}>
                  <TextInput
                    value={destinationAmount}
                    onChangeText={(value) => {
                      setDestinationAmount(value);
                      setDestinationEdited(true);
                      setRateError(null);
                      setPreserveStoredConversion(false);
                      setErrors((current) => ({ ...current, destinationAmount: "" }));
                    }}
                    placeholder="0"
                    placeholderTextColor={theme.secondaryLabel}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    accessibilityLabel={`Montant crédité en ${destinationCurrency}`}
                    style={{ color: theme.label, fontSize: 24, fontWeight: "600", fontVariant: ["tabular-nums"], flex: 1 }}
                  />
                  <Text style={{ color: theme.secondaryLabel }}>{destinationCurrency}</Text>
                </View>
                {isCrossCurrency && exchangeRate ? (
                  <Text style={{ color: theme.secondaryLabel, fontSize: 12 }}>
                    1 {sourceCurrency} = {exchangeRate.toLocaleString("fr-FR", { maximumFractionDigits: 8 })} {destinationCurrency}
                    {exchangeRateDate ? ` · taux du ${exchangeRateDate}` : ""}
                    {destinationEdited ? " · manuel" : ""}
                  </Text>
                ) : null}
                {isCrossCurrency && rateError ? (
                  <Text style={{ color: theme.expense, fontSize: 12 }}>{rateError}</Text>
                ) : null}
              </FormField>
            ) : null}
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
                  setFee("");
                  setFeeMode("manual");
                  setDebitedAmount("");
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
              layout="grid"
              onChange={(value) => {
                setCategoryId(value);
                setErrors((current) => ({ ...current, category: "" }));
              }}
            />
          </FormField>
        )}

        {type === "transfer" && goalReservationId == null ? (
          <View style={styles.feeSection}>
            <FormField label="Mode de saisie des frais">
              <View accessible accessibilityRole="radiogroup" style={styles.feeModeRow}>
                {FEE_MODES.map((option) => {
                  const active = feeMode === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => switchFeeMode(option.value)}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.feeModeButton,
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
                          fontWeight: "600",
                          textAlign: "center",
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </FormField>

            {feeMode === "manual" ? (
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
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
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
              </FormField>
            ) : (
              <FormField label="Total débité" error={errors.debitedAmount}>
                <TextInput
                  value={debitedAmount}
                  onChangeText={(value) => {
                    setDebitedAmount(value);
                    setErrors((current) => ({ ...current, debitedAmount: "" }));
                  }}
                  placeholder="0"
                  placeholderTextColor={theme.secondaryLabel}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  accessibilityLabel={`Total débité en ${sourceCurrency}`}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.separator,
                      color: theme.label,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.calculationCard,
                    { backgroundColor: theme.surfaceElevated },
                  ]}
                >
                  <Text style={{ color: theme.secondaryLabel }}>Frais calculés</Text>
                  <Text selectable style={{ color: theme.label, fontWeight: "600" }}>
                    {calculatedFeePreview == null
                      ? "—"
                      : formatAmount(calculatedFeePreview, sourceCurrency)}
                  </Text>
                </View>
              </FormField>
            )}
          </View>
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
            <Text style={{ color: theme.label, fontWeight: "600" }}>
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
              { backgroundColor: theme.surface, borderColor: theme.separator },
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
              { backgroundColor: theme.surface, borderColor: theme.separator },
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
            maxLength={200}
            returnKeyType="done"
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
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 32,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feeSection: {
    gap: spacing.sm,
  },
  feeModeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  feeModeButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calculationCard: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  dateButton: {
    flex: 1,
    minHeight: 48,
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
  saveNotice: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
