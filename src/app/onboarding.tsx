import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { useCurrency } from "@/currency/context";
import {
  DEFAULT_CURRENCY_CODE,
  FALLBACK_CURRENCY_DEFINITIONS,
  currencyLabel,
  parseMoneyInput,
} from "@/currency/currencies";
import { finishOnboarding, loadOnboardingCategories, loadOnboardingState, saveOnboardingAccount, setOnboardingStep } from "@/data/onboarding";
import { spacing, radius, useTheme, withAlpha } from "@/theme";
import type { Category, TransactionType } from "@/types";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";
import { SelectField } from "@/components/select-field";

type OnboardingStep = 1 | 2;

const TRANSACTION_TYPES: { value: Exclude<TransactionType, "transfer">; label: string }[] = [
  { value: "income", label: "Revenu" },
  { value: "expense", label: "Dépense" },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { currencies, refresh } = useCurrency();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [accountName, setAccountName] = useState("");
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_CURRENCY_CODE);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [transactionType, setTransactionType] = useState<Exclude<TransactionType, "transfer">>("income");
  const [amount, setAmount] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const availableCurrencies = currencies.length > 0 ? currencies : FALLBACK_CURRENCY_DEFINITIONS;
  const horizontalPadding = width < 360 ? spacing.lg : spacing.xl;
  const currencyOptions = useMemo(
    () => availableCurrencies.map((currency, index) => ({
      id: index + 1,
      label: currencyLabel(currency),
      code: currency.code,
    })),
    [availableCurrencies],
  );
  const categoryOptions = useMemo(
    () => categories
      .filter((category) => category.type === transactionType)
      .map((category) => ({ id: category.id, label: category.name, icon: category.icon })),
    [categories, transactionType],
  );

  useEffect(() => {
    if (step !== 2) return;
    let active = true;
    void loadOnboardingCategories()
      .then((rows) => {
        if (active) setCategories(rows);
      })
      .catch((cause) => {
        log.error("onboarding.categories", "Échec du chargement des catégories", cause);
        if (active) setError(userMessage(cause, "Impossible de charger les catégories."));
      });
    return () => {
      active = false;
    };
  }, [step]);

  const selectedCategoryId = categoryOptions.some((option) => option.id === categoryId)
    ? categoryId
    : categoryOptions[0]?.id ?? null;

  useEffect(() => {
    let active = true;
    void loadOnboardingState()
      .then(({ started, draftName, draftCurrency, draftStep, account }) => {

        if (active && draftName) setAccountName(draftName);
        if (active && draftCurrency) setCurrencyCode(draftCurrency);

        if (started !== "1" || !account) {
          if (active && draftStep === "2") setStep(2);
          return;
        }

        if (active && account) {
          setAccountId(account.id);
          setAccountName(account.name);
          setCurrencyCode(account.currencyCode);
          setStep(2);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const continueToTransaction = async () => {
    if (!accountName.trim()) {
      setError("Saisissez un nom pour votre premier compte.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveOnboardingAccount({ accountId, name: accountName, currencyCode });
      setStep(2);
    } catch (cause) {
      log.error("onboarding.account", "Échec de l'enregistrement du premier compte", cause);
      setError(userMessage(cause, "Impossible d'enregistrer le compte."));
    } finally {
      setSaving(false);
    }
  };

  const finish = async (withTransaction: boolean) => {
    const parsedAmount = parseMoneyInput(amount, currencyCode);
    if (withTransaction && (parsedAmount == null || Number.isNaN(parsedAmount) || parsedAmount <= 0)) {
      setError(`Saisissez un montant valide en ${currencyCode}.`);
      return;
    }
    if (withTransaction && selectedCategoryId == null) {
      setError("Choisissez une catégorie.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await finishOnboarding({
        accountId,
        accountName,
        currencyCode,
        withTransaction,
        transactionType,
        amount: parsedAmount,
        categoryId: selectedCategoryId,
      });
      void refresh();
      if (!result.cloudWelcomeSeen) router.replace("/cloud-welcome");
      else router.replace("/(tabs)/(dashboard)");
    } catch (cause) {
      log.error("onboarding.finish", "Échec de la finalisation de l’onboarding", cause);
      setError(userMessage(cause, "Impossible de terminer la configuration."));
    } finally {
      setSaving(false);
    }
  };

  const editAccount = () => {
    setError(null);
    setStep(1);
    void setOnboardingStep(1)
      .catch(() => {});
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
      >
        <Image
          source={require("../../assets/images/wallet-logo-green-v4.png")}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Logo Wallet"
          resizeMode="contain"
          style={styles.logo}
        />
        <View
          style={styles.progressRow}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Étape ${step} sur 2`}
          accessibilityValue={{ min: 1, max: 2, now: step }}
        >
          {[1, 2].map((item) => (
            <View
              key={item}
              style={[styles.progress, { backgroundColor: item <= step ? theme.accent : theme.separator }]}
            />
          ))}
        </View>
        <Text style={[styles.eyebrow, { color: theme.accent }]}>BIENVENUE DANS WALLET</Text>
        <Text style={[styles.title, { color: theme.label }]}>Votre argent, simplement.</Text>
        <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}> 
          {step === 1
            ? "Créons votre premier compte et choisissons la devise qui servira de référence."
            : "Ajoutez un premier mouvement pour voir immédiatement votre solde disponible."}
        </Text>

        {error ? <InlineError message={error} onRetry={() => setError(null)} /> : null}

        {step === 1 ? (
          <View style={styles.form}>
            <FormField label="Nom du compte">
              <TextInput
                value={accountName}
                onChangeText={(value) => {
                  setAccountName(value);
                  setError(null);
                }}
                placeholder="Ex. : Compte principal"
                placeholderTextColor={theme.secondaryLabel}
                accessibilityLabel="Nom du premier compte"
                autoFocus
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={() => void continueToTransaction()}
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.label }]}
              />
            </FormField>
            <FormField label="Devise de référence" hint="Elle sera utilisée pour les totaux, budgets et objectifs.">
              <SelectField
                label="Devise de référence"
                hideLabel
                value={currencyOptions.find((option) => option.code === currencyCode)?.label ?? currencyCode}
                options={currencyOptions}
                onChange={(id) => setCurrencyCode(currencyOptions.find((option) => option.id === id)?.code ?? currencyCode)}
              />
            </FormField>
            <ActionButton
              label={saving ? "Enregistrement…" : "Continuer vers le premier mouvement"}
              onPress={() => void continueToTransaction()}
              disabled={saving}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <View
              accessible
              accessibilityRole="summary"
              accessibilityLabel={`Premier compte : ${accountName}. Devise : ${currencyCode}.`}
              style={[styles.accountSummary, { backgroundColor: theme.surfaceElevated }]}
            >
              <View style={styles.accountSummaryText}>
                <Text style={[styles.accountSummaryLabel, { color: theme.secondaryLabel }]}>PREMIER COMPTE</Text>
                <Text style={[styles.accountSummaryName, { color: theme.label }]} numberOfLines={1}>
                  {accountName}
                </Text>
                <Text style={{ color: theme.secondaryLabel }}>{currencyCode}</Text>
              </View>
              <Pressable
                onPress={editAccount}
                accessibilityRole="button"
                accessibilityLabel="Modifier le premier compte"
                accessibilityHint="Revient à l’étape précédente pour modifier le nom ou la devise."
                style={({ pressed }) => [styles.editAccountButton, pressed && { opacity: 0.65 }]}
              >
                <Text style={{ color: theme.accent, fontWeight: "800" }}>Modifier</Text>
              </Pressable>
            </View>
            <View style={styles.typeRow}>
              {TRANSACTION_TYPES.map((item) => {
                const selected = item.value === transactionType;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => {
                      setTransactionType(item.value);
                      setCategoryId(null);
                      setError(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityHint="Sélectionne le type de la première transaction."
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.typeButton,
                      { backgroundColor: selected ? theme.accent : theme.surface, borderColor: selected ? theme.accent : theme.separator },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: selected ? theme.onAccent : theme.label, fontWeight: "700" }}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <FormField label={`Montant (${currencyCode})`}>
              <TextInput
                value={amount}
                onChangeText={(value) => {
                  setAmount(value);
                  setError(null);
                }}
                placeholder="0"
                placeholderTextColor={theme.secondaryLabel}
                accessibilityLabel={`Montant en ${currencyCode}`}
                keyboardType="decimal-pad"
                inputMode="decimal"
                maxLength={18}
                returnKeyType="done"
                style={[styles.input, styles.amountInput, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.label }]}
              />
            </FormField>
            <FormField label="Catégorie">
              <SelectField
                label="Catégorie"
                hideLabel
                value={categoryOptions.find((option) => option.id === selectedCategoryId)?.label ?? null}
                options={categoryOptions}
                layout="grid"
                onChange={setCategoryId}
              />
            </FormField>
            {categoryOptions.length === 0 ? (
              <Text style={[styles.disabledHint, { color: theme.secondaryLabel }]}> 
                Aucune catégorie disponible pour ce type de transaction.
              </Text>
            ) : null}
            <ActionButton
              label={saving ? "Enregistrement…" : "Ajouter la transaction"}
              onPress={() => void finish(true)}
              disabled={saving || categoryOptions.length === 0}
            />
            <ActionButton
              label="Je le ferai plus tard"
              variant="secondary"
              onPress={() => void finish(false)}
              disabled={saving}
            />
          </View>
        )}
        <Text style={[styles.privacy, { color: withAlpha(theme.secondaryLabel, "B0") }]}>Vos données restent sur votre appareil.</Text>
      </KeyboardAwareScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  logo: {
    alignSelf: "center",
    width: 132,
    height: 132,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  progress: {
    height: 4,
    flex: 1,
    borderRadius: 99,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: spacing.sm,
  },
  disabledHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -spacing.sm,
  },
  form: {
    gap: spacing.lg,
  },
  accountSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  accountSummaryText: {
    flex: 1,
    gap: spacing.xs,
  },
  accountSummaryLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  accountSummaryName: {
    fontSize: 17,
    fontWeight: "800",
  },
  editAccountButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  input: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
  },
  amountInput: {
    fontSize: 24,
    fontWeight: "700",
  },
  typeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  typeButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  privacy: {
    alignSelf: "center",
    fontSize: 12,
    marginTop: spacing.lg,
  },
});
