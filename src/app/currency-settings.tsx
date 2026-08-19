import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { SelectField } from "@/components/select-field";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { useCurrency } from "@/currency/context";
import { currencyLabel } from "@/currency/currencies";
import { changeReferenceCurrency } from "@/currency/service";
import { getDatabase } from "@/db/database";
import { spacing, typography, useTheme } from "@/theme";
import { formatDate, formatTime } from "@/utils/format";
import { log } from "@/utils/logger";
import { userMessage } from "@/utils/user-message";

export default function CurrencySettingsScreen() {
  const theme = useTheme();
  const { baseCurrency, currencies, stale, lastRefresh, refresh, loading } = useCurrency();
  const [selected, setSelected] = useState(baseCurrency);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(
    () => currencies.map((currency, index) => ({ id: index + 1, label: currencyLabel(currency), code: currency.code })),
    [currencies],
  );

  const save = async () => {
    if (selected === baseCurrency) return;
    setError(null);
    setSaving(true);
    try {
      const db = await getDatabase();
      await changeReferenceCurrency(db, selected);
      await refresh(true);
      Alert.alert("Devise modifiée", `Les budgets et objectifs sont maintenant en ${selected}.`);
    } catch (error) {
      log.error("currency.change", "Échec du changement de devise de référence", error);
      setError(userMessage(error, "Taux indisponible."));
    } finally {
      setSaving(false);
    }
  };

  const refreshRates = async () => {
    setError(null);
    setRefreshing(true);
    try {
      await refresh(true);
    } catch (error) {
      log.error("currency.refresh", "Échec de l'actualisation des taux", error);
      setError(userMessage(error, "Les taux n’ont pas pu être actualisés."));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Devises" }} />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      >
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.label }]}>Devise de référence</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Elle sert à afficher les totaux, budgets et objectifs dans une même unité.</Text>
        </View>
        {error ? <InlineError message={error} /> : null}
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
          label={refreshing || loading ? "Actualisation…" : "Actualiser les taux"}
          variant="secondary"
          onPress={() => void refreshRates()}
          disabled={loading || saving || refreshing}
        />
      </KeyboardAwareScreen>
    </>
  );
}

const styles = {
  intro: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  title: typography.title,
  subtitle: typography.body,
};
