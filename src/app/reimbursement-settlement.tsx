import DateTimePicker from "@react-native-community/datetimepicker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { SelectField } from "@/components/select-field";
import { ActionButton, FormField, KeyboardAwareScreen, ScreenState } from "@/components/ui";
import { loadReimbursementSettlement, settleLocalReimbursement } from "@/data/transaction-detail";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { currencyDigits, parseMoneyInput } from "@/currency/currencies";
import { radius, spacing, useTheme } from "@/theme";
import { formatAmount, formatDate } from "@/utils/format";
import { userMessage } from "@/utils/user-message";

export default function ReimbursementSettlementScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const reimbursementId = Number(id);
  const load = useCallback(async () => {
    return loadReimbursementSettlement(reimbursementId);
  }, [reimbursementId]);
  const resource = useAsyncResource(load, "reimbursement.settlement.load");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const data = resource.data;
  const selectedAccount = data?.accounts.find((account) => account.id === accountId) ?? data?.accounts[0] ?? null;
  const sourceCurrency = selectedAccount?.currencyCode ?? "XOF";
  const accountOptions = useMemo(
    () => (data?.accounts ?? []).map((account) => ({ id: account.id, label: `${account.name} · ${account.currencyCode}` })),
    [data?.accounts],
  );
  const categoryOptions = useMemo(
    () => (data?.categories ?? []).map((category) => ({ id: category.id, label: category.name, icon: category.icon })),
    [data?.categories],
  );

  if (!data) {
    return (
      <ScreenState
        status={resource.status === "error" ? "error" : "loading"}
        message={userMessage(resource.error)}
        onRetry={() => void resource.reload()}
      />
    );
  }

  const save = async () => {
    const parsed = parseMoneyInput(amount, sourceCurrency);
    const selectedAccountId = accountId ?? data.accounts[0]?.id ?? null;
    if (parsed == null || !Number.isInteger(parsed) || parsed <= 0 || parsed > data.reimbursement.remainingAmount) {
      Alert.alert("Montant invalide", `Le règlement doit être compris entre 1 et ${formatAmount(data.reimbursement.remainingAmount, sourceCurrency)}.`);
      return;
    }
    if (selectedAccountId == null || categoryId == null) {
      Alert.alert("Informations manquantes", "Choisissez un compte et une catégorie.");
      return;
    }
    setSaving(true);
    try {
      await settleLocalReimbursement(reimbursementId, parsed, {
        type: data.type,
        amount: parsed,
        categoryId,
        accountId: selectedAccountId,
        destinationAccountId: null,
        fee: null,
        note: `Règlement de ${data.reimbursement.personName}`,
        transactionDate: date.getTime(),
      });
      router.back();
    } catch (error) {
      Alert.alert("Impossible d'enregistrer", userMessage(error));
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Enregistrer le règlement" }} />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: theme.label, fontSize: 20, fontWeight: "800" }}>Règlement de {data.reimbursement.personName}</Text>
          <Text selectable style={{ color: theme.secondaryLabel }}>
            Solde restant : {formatAmount(data.reimbursement.remainingAmount, sourceCurrency)}
          </Text>
        </View>
        <FormField label={`Montant (${sourceCurrency})`}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder={(data.reimbursement.remainingAmount / 10 ** currencyDigits(sourceCurrency)).toString()}
            placeholderTextColor={theme.secondaryLabel}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={{ backgroundColor: theme.surface, borderColor: theme.separator, color: theme.label, borderWidth: 1, borderRadius: radius.md, padding: spacing.md }}
          />
        </FormField>
        <SelectField
          label="Compte"
          value={accountOptions.find((option) => option.id === (accountId ?? data.accounts[0]?.id))?.label ?? null}
          options={accountOptions}
          onChange={setAccountId}
        />
        <SelectField
          label="Catégorie"
          value={categoryOptions.find((option) => option.id === categoryId)?.label ?? null}
          options={categoryOptions}
          onChange={setCategoryId}
        />
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{ backgroundColor: theme.surface, borderColor: theme.separator, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs }}
        >
          <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>Date du règlement</Text>
          <Text style={{ color: theme.label, fontWeight: "700" }}>{formatDate(date.getTime())}</Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            mode="date"
            value={date}
            onValueChange={(_, nextDate) => {
              setShowDatePicker(false);
              if (nextDate) setDate(nextDate);
            }}
            onDismiss={() => setShowDatePicker(false)}
          />
        ) : null}
        <ActionButton onPress={() => void save()} disabled={saving} label={saving ? "Enregistrement…" : "Enregistrer le règlement"} />
      </KeyboardAwareScreen>
    </>
  );
}
