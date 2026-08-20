import { File } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { ActionButton, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { SelectField } from "@/components/select-field";
import { listAccountsByUsage } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import {
  applyCsvImport,
  inferCsvMapping,
  parseCsvText,
  previewCsvImport,
  type ParsedCsvDocument,
} from "@/db/csv-import";
import { spacing, useTheme } from "@/theme";
import type { Account, CsvImportMapping, CsvImportPreview, CsvImportReport } from "@/types";
import { userMessage } from "@/utils/user-message";

type Step = 1 | 2 | 3 | 4;

export default function CsvImportScreen() {
  const theme = useTheme();
  const [step, setStep] = useState<Step>(1);
  const [document, setDocument] = useState<ParsedCsvDocument | null>(null);
  const [content, setContent] = useState("");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CsvImportMapping | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [previews, setPreviews] = useState<CsvImportPreview[]>([]);
  const [report, setReport] = useState<CsvImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getDatabase()
      .then((db) => listAccountsByUsage(db))
      .then((rows) => {
        setAccounts(rows);
        if (rows.length === 1) setAccountId(rows[0].id);
      })
      .catch((cause) => setError(userMessage(cause, "Impossible de charger les comptes.")));
  }, []);

  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const accountOptions = useMemo(
    () => accounts.map((account) => ({ id: account.id, label: `${account.name} · ${account.currencyCode}` })),
    [accounts],
  );

  const pickFile = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/plain", "application/vnd.ms-excel"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    try {
      const asset = result.assets[0];
      const text = await new File(asset.uri).text();
      const parsed = parseCsvText(text);
      setContent(text);
      setDocument(parsed);
      setMapping(inferCsvMapping(parsed.headers));
      setSourceName(asset.name);
      setStep(2);
    } catch (cause) {
      setError(userMessage(cause, "Impossible de lire ce fichier CSV."));
    }
  };

  const chooseColumn = (field: "date" | "amount", value: number) => {
    const header = document?.headers[value] ?? "";
    setMapping((current) => current ? { ...current, [field]: header } : current);
  };

  const buildPreview = async () => {
    if (!mapping || accountId == null || selectedAccount == null) {
      setError("Choisissez un compte et associez les colonnes Date et Montant.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const db = await getDatabase();
      const rows = await previewCsvImport(db, content, {
        accountId,
        currencyCode: selectedAccount.currencyCode,
        mapping,
      });
      setPreviews(rows);
      setStep(3);
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!mapping || accountId == null || selectedAccount == null) return;
    setLoading(true);
    setError(null);
    try {
      const db = await getDatabase();
      const result = await applyCsvImport(db, previews, {
        accountId,
        currencyCode: selectedAccount.currencyCode,
        mapping,
        sourceName,
      });
      setReport(result);
      setStep(4);
    } catch (cause) {
      setError(userMessage(cause, "L'import a été annulé; aucune ligne n'a été écrite."));
    } finally {
      setLoading(false);
    }
  };

  const columnOptions = (current: string) =>
    (document?.headers ?? []).map((header, index) => ({ id: index, label: header, selected: header === current }));

  return (
    <>
      <Stack.Screen options={{ title: "Importer un CSV" }} />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: theme.label, fontSize: 24, fontWeight: "800" }}>Importer un CSV</Text>
          <Text style={{ color: theme.secondaryLabel }}>Étape {step} sur 4 · ajout non destructif, hors ligne.</Text>
        </View>
        {error ? <InlineError message={error} onRetry={() => setError(null)} /> : null}

        {step === 1 ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: theme.secondaryLabel }}>Sélectionnez un fichier CSV ou texte séparé par virgules, points-virgules ou tabulations.</Text>
            <ActionButton label="Choisir un fichier" onPress={() => void pickFile()} />
          </View>
        ) : null}

        {step === 2 && document && mapping ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: theme.label, fontWeight: "700" }}>Mapping des colonnes</Text>
            <SelectField
              label="Date obligatoire"
              value={mapping.date || null}
              options={columnOptions(mapping.date)}
              onChange={(value) => chooseColumn("date", value)}
            />
            <SelectField
              label="Montant obligatoire"
              value={mapping.amount || null}
              options={columnOptions(mapping.amount)}
              onChange={(value) => chooseColumn("amount", value)}
            />
            <SelectField
              label="Compte cible"
              value={accountOptions.find((option) => option.id === accountId)?.label ?? null}
              options={accountOptions}
              onChange={setAccountId}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}><ActionButton label="Changer de fichier" variant="secondary" onPress={() => setStep(1)} /></View>
              <View style={{ flex: 1 }}><ActionButton label={loading ? "Préparation…" : "Prévisualiser"} disabled={loading} onPress={() => void buildPreview()} /></View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: theme.label, fontWeight: "700" }}>{previews.length} lignes détectées</Text>
            {previews.slice(0, 40).map((preview) => (
              <View key={preview.rowNumber} style={{ gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.separator }}>
                <Text style={{ color: theme.label, fontWeight: "600" }}>Ligne {preview.rowNumber} · {preview.parsed?.merchant ?? "Sans marchand"}</Text>
                <Text style={{ color: preview.issues.some((issue) => issue.severity === "error") ? theme.expense : preview.probableDuplicate ? theme.secondaryLabel : theme.label, fontSize: 13 }}>
                  {preview.issues.map((issue) => issue.message).join(" · ") || (preview.probableDuplicate ? "Doublon probable, désélectionné" : preview.selected ? "Sera importée" : "Ignorée")}
                </Text>
              </View>
            ))}
            {previews.length > 40 ? <Text style={{ color: theme.secondaryLabel }}>Aperçu limité aux 40 premières lignes.</Text> : null}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}><ActionButton label="Modifier le mapping" variant="secondary" onPress={() => setStep(2)} /></View>
              <View style={{ flex: 1 }}><ActionButton label={loading ? "Import…" : "Importer les lignes sélectionnées"} disabled={loading || previews.every((preview) => !preview.selected)} onPress={() => void apply()} /></View>
            </View>
          </View>
        ) : null}

        {step === 4 && report ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: theme.income, fontSize: 20, fontWeight: "800" }}>Import terminé</Text>
            <Text selectable style={{ color: theme.label }}>{report.inserted} transaction(s) ajoutée(s).</Text>
            <Text selectable style={{ color: theme.secondaryLabel }}>{report.skipped} ligne(s) ignorée(s), dont {report.duplicates} doublon(s) probable(s).</Text>
            <Text selectable style={{ color: theme.secondaryLabel }}>{report.invalidRows} ligne(s) invalide(s).</Text>
            {report.unknownCategories.length > 0 ? <Text style={{ color: theme.secondaryLabel }}>Catégories inconnues laissées non catégorisées : {report.unknownCategories.join(", ")}.</Text> : null}
            <ActionButton label="Importer un autre fichier" variant="secondary" onPress={() => { setStep(1); setReport(null); setPreviews([]); }} />
          </View>
        ) : null}
      </KeyboardAwareScreen>
    </>
  );
}
