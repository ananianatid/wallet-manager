import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SelectField } from "@/components/select-field";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen, ScreenState } from "@/components/ui";
import { listAccountGroups } from "@/db/account-groups";
import {
  getAccount,
  planBalanceAdjustment,
  setAccountBalance,
  updateAccountDetails,
  updateAccountFlags,
} from "@/db/accounts";
import { getDatabase } from "@/db/database";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { radius, spacing, useTheme } from "@/theme";
import { formatAmount } from "@/utils/format";
import { currencyDigits, parseMoneyInput } from "@/currency/currencies";

const parseAmount = (value: string, currency: string): number | null => {
  const parsed = parseMoneyInput(value, currency);
  return parsed == null ? null : parsed;
};

export default function EditAccountScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);

  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [hidden, setHidden] = useState(false);
  const [excludeFromTotal, setExcludeFromTotal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const db = await getDatabase();
    const [acc, groups] = await Promise.all([
      getAccount(db, accountId),
      listAccountGroups(db),
    ]);
    if (acc) {
      setName(acc.name);
      setGroupId(acc.groupId);
      setAmount((acc.balance / 10 ** currencyDigits(acc.currencyCode)).toString());
      setDescription(acc.description ?? "");
      setHidden(acc.hidden);
      setExcludeFromTotal(acc.excludeFromTotal);
    }
    return { account: acc, accountGroups: groups };
  }, [accountId]);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const account = resource.data?.account ?? null;
  const accountGroups = useMemo(
    () => resource.data?.accountGroups ?? [],
    [resource.data?.accountGroups],
  );
  const groupOptions = useMemo(
    () => [
      { id: -1, label: "Sans groupe" },
      ...accountGroups.map((g) => ({ id: g.id, label: g.name })),
    ],
    [accountGroups],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const accountCurrency = account?.currencyCode ?? "XOF";
  const target = parseAmount(amount, accountCurrency);
  const balance = account?.balance ?? 0;
  const adjustment =
    target == null || Number.isNaN(target)
      ? null
      : planBalanceAdjustment(balance, target);

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) {
      nextErrors.name = "Saisissez un nom.";
    }
    if (Number.isNaN(target)) {
      nextErrors.amount = `Saisissez un montant valide en ${accountCurrency}.`;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const db = await getDatabase();
      await db.withTransactionAsync(async () => {
        await updateAccountDetails(db, accountId, {
          name,
          groupId: groupId!,
          description,
        });
        await updateAccountFlags(db, accountId, { hidden, excludeFromTotal });
        if (target != null && adjustment != null) {
          await setAccountBalance(db, accountId, target);
        }
      });
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Impossible d'enregistrer.");
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Modifier le compte" }} />
      {!resource.data?.account ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={resource.error?.message}
          onRetry={() => void resource.reload()}
        />
      ) : (
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        {saveError ? <InlineError message={saveError} onRetry={() => setSaveError(null)} /> : null}

        <View style={{ gap: spacing.md }}>
          <FormField label="Nom" error={errors.name}>
            <TextInput
              value={name}
              onChangeText={(value) => {
                setName(value);
                setErrors((current) => ({ ...current, name: "" }));
              }}
              placeholder="Nom du compte"
              placeholderTextColor={theme.secondaryLabel}
              maxLength={40}
              style={{
                color: theme.label,
                backgroundColor: theme.surface,
                borderColor: theme.separator,
                borderWidth: StyleSheet.hairlineWidth,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                borderRadius: radius.md,
              }}
            />
          </FormField>

          <FormField label="Groupe de comptes" error={errors.group}>
            <SelectField
              label="Groupe de comptes"
              hideLabel
              value={
                groupId == null
                  ? "Sans groupe"
                  : (accountGroups.find((g) => g.id === groupId)?.name ?? null)
              }
              options={groupOptions}
              onChange={(value) => {
                setGroupId(value === -1 ? null : value);
                setErrors((current) => ({ ...current, group: "" }));
              }}
            />
          </FormField>

          <FormField label="Montant (solde)" error={errors.amount}>
            <View style={{ gap: spacing.sm }}>
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
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Solde du compte en FCFA"
                  style={{
                    color: theme.label,
                    fontSize: 36,
                    fontWeight: "800",
                    fontVariant: ["tabular-nums"],
                    textAlign: "center",
                    minWidth: 160,
                  }}
                />
                  <Text style={{ color: theme.secondaryLabel }}>{account?.currencyCode ?? "XOF"}</Text>
              </View>
              {adjustment ? (
                <Text
                  style={{
                    color:
                      adjustment.type === "income" ? theme.income : theme.expense,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                  accessibilityLiveRegion="polite"
                >
                  {adjustment.type === "income" ? "+" : "−"}
                  {formatAmount(adjustment.amount, account?.currencyCode ?? "XOF")} →{" "}
                  {adjustment.type === "income" ? "revenu" : "dépense"} « Équilibre »
                </Text>
              ) : (
                <Text style={{ color: theme.secondaryLabel, fontSize: 12, textAlign: "center" }}>
                  {amount.trim() === "" || Number.isNaN(target)
                    ? "Saisissez un solde cible."
                    : "Solde inchangé, aucune transaction créée."}
                </Text>
              )}
            </View>
          </FormField>

          <FormField label="Devise du compte">
            <View style={{ backgroundColor: theme.surface, borderRadius: radius.md, padding: spacing.md }}>
              <Text style={{ color: theme.label, fontWeight: "700" }}>{account?.currencyCode ?? "XOF"}</Text>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13, marginTop: spacing.xs }}>
                La devise est immuable après la création du compte.
              </Text>
            </View>
          </FormField>

          <FormField label="Description (optionnel)">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Décrivez ce compte"
              placeholderTextColor={theme.secondaryLabel}
              multiline
              maxLength={200}
              style={{
                color: theme.label,
                backgroundColor: theme.surface,
                borderColor: theme.separator,
                borderWidth: StyleSheet.hairlineWidth,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                borderRadius: radius.md,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </FormField>
        </View>

        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.label, fontWeight: "600" }}>Masquer le compte</Text>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                Retiré des listes et des sélecteurs de transaction.
              </Text>
            </View>
            <Switch
              value={hidden}
              onValueChange={setHidden}
              trackColor={{ true: theme.accent }}
              thumbColor={theme.accentSurfaceText}
            />
          </View>
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.separator,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.label, fontWeight: "600" }}>
                Exclure du total (patrimoine)
              </Text>
              <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                Ce compte est exclu du patrimoine.
              </Text>
            </View>
            <Switch
              value={excludeFromTotal}
              onValueChange={setExcludeFromTotal}
              trackColor={{ true: theme.accent }}
              thumbColor={theme.accentSurfaceText}
            />
          </View>
        </View>

        <ActionButton
          label="Enregistrer"
          onPress={save}
          disabled={saving}
        />
      </KeyboardAwareScreen>
      )}
    </>
  );
}
