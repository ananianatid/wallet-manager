import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { SelectField } from "@/components/select-field";
import { ActionButton, FormField, KeyboardAwareScreen } from "@/components/ui";
import { useCurrency } from "@/currency/context";
import { currencyLabel } from "@/currency/currencies";
import { changeReferenceCurrency } from "@/currency/service";
import { getDatabase } from "@/db/database";
import { spacing, useTheme } from "@/theme";
import { formatDate, formatTime } from "@/utils/format";

export default function CurrencySettingsScreen() {
  const theme = useTheme();
  const { baseCurrency, currencies, stale, lastRefresh, refresh, loading } = useCurrency();
  const [selected, setSelected] = useState(baseCurrency);
  const [saving, setSaving] = useState(false);
  const options = useMemo(
    () => currencies.map((currency, index) => ({ id: index + 1, label: currencyLabel(currency), code: currency.code })),
    [currencies],
  );

  const save = async () => {
    if (selected === baseCurrency) return;
    setSaving(true);
    try {
      const db = await getDatabase();
      await changeReferenceCurrency(db, selected);
      await refresh(true);
      Alert.alert("Devise modifiée", `Les budgets et objectifs sont maintenant en ${selected}.`);
    } catch (error) {
      Alert.alert("Changement impossible", error instanceof Error ? error.message : "Taux indisponible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Devises" }} />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        <FormField label="Devise de référence">
          <SelectField
            label="Devise de référence"
            hideLabel
            value={options.find((option) => option.code === selected)?.label ?? selected}
            options={options}
            onChange={(id) => setSelected(options.find((option) => option.id === id)?.code ?? selected)}
          />
        </FormField>
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: theme.label, fontWeight: "700" }}>À propos des conversions</Text>
          <Text style={{ color: theme.secondaryLabel, lineHeight: 20 }}>
            Les soldes restent dans la devise de chaque compte. Les totaux, budgets et objectifs utilisent cette devise de référence.
          </Text>
          {lastRefresh != null ? (
            <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
              Dernier taux : {formatDate(lastRefresh)} à {formatTime(lastRefresh)}{stale ? " · hors connexion" : ""}
            </Text>
          ) : null}
        </View>
        <ActionButton
          label={saving ? "Conversion…" : "Enregistrer la devise"}
          onPress={() => void save()}
          disabled={saving || loading || selected === baseCurrency}
        />
        <ActionButton
          label="Actualiser les taux"
          variant="secondary"
          onPress={() => void refresh(true)}
          disabled={loading || saving}
        />
      </KeyboardAwareScreen>
    </>
  );
}
