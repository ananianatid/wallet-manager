import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { SQLiteDatabase } from "expo-sqlite";
import { currencyDigits } from "@/currency/currencies";
import type {
  CsvImportMapping,
  CsvImportPreview,
  CsvImportReport,
  CsvParsedRow,
  CsvRowIssue,
  ImportBatch,
  TransactionInput,
  TransactionType,
} from "@/types";
import { insertJournalTransaction } from "./journal";

export interface ParsedCsvDocument {
  separator: "," | ";" | "\t";
  headers: string[];
  rows: Record<string, string>[];
}

export interface CsvPreviewOptions {
  accountId: number;
  currencyCode: string;
  mapping: CsvImportMapping;
}

export interface CsvApplyOptions extends CsvPreviewOptions {
  sourceName?: string | null;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

export function detectCsvSeparator(text: string): ParsedCsvDocument["separator"] {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const candidates: ParsedCsvDocument["separator"][] = [",", ";", "\t"];
  let best: ParsedCsvDocument["separator"] = ",";
  let bestCount = -1;
  for (const separator of candidates) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i];
      if (char === '"' && firstLine[i + 1] === '"') {
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === separator && !quoted) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = separator;
      bestCount = count;
    }
  }
  return best;
}

function parseCsvLine(line: string, separator: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let record = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        record += '""';
        i += 1;
      } else {
        quoted = !quoted;
        record += char;
      }
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      if (record.trim() !== "") records.push(record);
      record = "";
    } else {
      record += char;
    }
  }
  if (record.trim() !== "") records.push(record);
  return records;
}

export function parseCsvText(text: string): ParsedCsvDocument {
  const separator = detectCsvSeparator(text);
  const records = splitCsvRecords(text.replace(/^\uFEFF/, ""));
  const headerRecord = records.shift() ?? "";
  const headers = parseCsvLine(headerRecord, separator).map((header) => header.trim());
  const rows = records.map((record) => {
    const values = parseCsvLine(record, separator);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });
  return { separator, headers, rows };
}

function findHeader(headers: string[], aliases: string[]): string | undefined {
  return headers.find((header) => aliases.includes(normalizeHeader(header)));
}

export function inferCsvMapping(headers: string[]): CsvImportMapping {
  return {
    date: findHeader(headers, ["date", "jour", "transaction date"]) ?? "",
    amount: findHeader(headers, ["montant", "amount", "somme", "valeur", "debit", "credit"]) ?? "",
    type: findHeader(headers, ["type", "nature", "sens"]),
    merchant: findHeader(headers, ["marchand", "merchant", "commercant", "payee", "beneficiaire"]),
    description: findHeader(headers, ["description", "libelle", "libelle operation"]),
    note: findHeader(headers, ["note", "memo", "commentaire"]),
    category: findHeader(headers, ["categorie", "category"]),
    tags: findHeader(headers, ["tags", "tag", "etiquettes"]),
    sourceAccount: findHeader(headers, ["compte source", "source account", "from account"]),
    destinationAccount: findHeader(headers, ["compte destination", "destination account", "to account"]),
  };
}

function getValue(row: Record<string, string>, header: string | undefined): string {
  return header ? row[header]?.trim() ?? "" : "";
}

function parseDate(value: string): number | null {
  const input = value.trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(input);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
      ? date.getTime()
      : null;
  }
  match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(input);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
    return date.getFullYear() === year && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[1])
      ? date.getTime()
      : null;
  }
  return null;
}

function parseAmount(value: string, currencyCode: string): { amount: number; negative: boolean } | null {
  const input = value.trim().replace(/[\s\u00A0]/g, "");
  if (!input) return null;
  const negative = input.startsWith("-");
  const unsigned = input.replace(/^[+-]/, "").replace(/[^0-9.,]/g, "");
  if (!unsigned || !/[0-9]/.test(unsigned)) return null;
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  let normalized = unsigned;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot);
    const integerPart = unsigned.slice(0, decimalIndex).replace(/[.,]/g, "");
    normalized = `${integerPart}.${unsigned.slice(decimalIndex + 1)}`;
  } else if (lastComma >= 0) {
    const decimals = unsigned.length - lastComma - 1;
    normalized = decimals > 0 && decimals <= 2
      ? `${unsigned.slice(0, lastComma)}.${unsigned.slice(lastComma + 1)}`
      : unsigned.replace(/,/g, "");
  } else if ((unsigned.match(/\./g) ?? []).length > 1) {
    normalized = unsigned.replace(/\./g, "");
  }
  const major = Number(normalized);
  if (!Number.isFinite(major) || major <= 0) return null;
  const amount = Math.round(major * 10 ** currencyDigits(currencyCode));
  return amount > 0 ? { amount, negative } : null;
}

function parseType(value: string): TransactionType | null {
  const normalized = normalizeHeader(value);
  if (["income", "revenu", "credit", "entree"].includes(normalized)) return "income";
  if (["expense", "depense", "debit", "sortie"].includes(normalized)) return "expense";
  if (["transfer", "transfert", "virement"].includes(normalized)) return "transfer";
  return null;
}

function fingerprint(value: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}

function rowFingerprint(row: CsvParsedRow, accountId: number, categoryId: number | null): string {
  return fingerprint([
    row.type ?? "",
    row.amount ?? "",
    accountId,
    row.date ?? "",
    row.merchant ?? "",
    row.note ?? "",
    categoryId ?? "",
  ].join("|"));
}

function parseRow(
  row: Record<string, string>,
  rowNumber: number,
  mapping: CsvImportMapping,
  currencyCode: string,
): { parsed: CsvParsedRow; issues: CsvRowIssue[] } {
  const issues: CsvRowIssue[] = [];
  const dateValue = getValue(row, mapping.date);
  const amountValue = getValue(row, mapping.amount);
  const date = parseDate(dateValue);
  const amountResult = parseAmount(amountValue, currencyCode);
  if (!dateValue) issues.push({ rowNumber, code: "missing_required", message: "La date est obligatoire.", severity: "error" });
  else if (date == null) issues.push({ rowNumber, code: "invalid_date", message: "La date n'est pas reconnue.", severity: "error" });
  if (!amountValue) issues.push({ rowNumber, code: "missing_required", message: "Le montant est obligatoire.", severity: "error" });
  else if (!amountResult) issues.push({ rowNumber, code: "invalid_amount", message: "Le montant n'est pas valide.", severity: "error" });
  const explicitTypeValue = getValue(row, mapping.type);
  const explicitType = explicitTypeValue ? parseType(explicitTypeValue) : null;
  if (explicitTypeValue && !explicitType) {
    issues.push({ rowNumber, code: "invalid_type", message: "Le type doit être revenu, dépense ou transfert.", severity: "error" });
  }
  const type = explicitType ?? (amountResult ? (amountResult.negative ? "expense" : "income") : null);
  const sourceAccountName = getValue(row, mapping.sourceAccount) || null;
  const destinationAccountName = getValue(row, mapping.destinationAccount) || null;
  if (type === "transfer" && (!sourceAccountName || !destinationAccountName)) {
    issues.push({ rowNumber, code: "transfer_accounts", message: "Un transfert exige explicitement un compte source et un compte destination.", severity: "error" });
  }
  const merchant = getValue(row, mapping.merchant) || null;
  const description = getValue(row, mapping.description) || null;
  const parsed: CsvParsedRow = {
    rowNumber,
    date,
    amount: amountResult?.amount ?? null,
    type,
    merchant: merchant ?? description,
    note: getValue(row, mapping.note) || (merchant ? description : null),
    categoryName: getValue(row, mapping.category) || null,
    tags: getValue(row, mapping.tags).split(/[;,|]/).map((tag) => tag.trim()).filter(Boolean),
    sourceAccountName,
    destinationAccountName,
  };
  return { parsed, issues };
}

export async function previewCsvImport(
  db: SQLiteDatabase,
  text: string,
  options: CsvPreviewOptions,
): Promise<CsvImportPreview[]> {
  const document = parseCsvText(text);
  if (!options.mapping.date || !options.mapping.amount) {
    throw new Error("Associez au minimum les colonnes Date et Montant.");
  }
  const categories = await db.getAllAsync<{ id: number; name: string; type: TransactionType }>(
    "SELECT id, name, type FROM categories WHERE type IN ('income', 'expense')",
  );
  const categoryByKey = new Map(categories.map((category) => [`${category.type}|${normalizeHeader(category.name)}`, category]));
  const previews: CsvImportPreview[] = [];
  for (let index = 0; index < document.rows.length; index++) {
    const row = document.rows[index];
    const { parsed, issues } = parseRow(row, index + 2, options.mapping, options.currencyCode);
    const category = parsed.type && parsed.categoryName
      ? categoryByKey.get(`${parsed.type}|${normalizeHeader(parsed.categoryName)}`)
      : null;
    if (parsed.categoryName && parsed.type !== "transfer" && !category) {
      issues.push({ rowNumber: parsed.rowNumber, code: "unknown_category", message: `Catégorie inconnue : ${parsed.categoryName}.`, severity: "warning" });
    }
    const rowHash = rowFingerprint(parsed, options.accountId, category?.id ?? null);
    const duplicate = parsed.type && parsed.amount != null && parsed.date != null
      ? await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM transactions
         WHERE type = ? AND amount = ? AND account_id = ? AND transaction_date = ?
           AND COALESCE(merchant, '') = COALESCE(?, '')
           AND COALESCE(note, '') = COALESCE(?, '')
           AND COALESCE(category_id, 0) = COALESCE(?, 0)
         LIMIT 1`,
        parsed.type,
        parsed.amount,
        options.accountId,
        parsed.date,
        parsed.merchant,
        parsed.note,
        category?.id ?? null,
      )
      : null;
    previews.push({
      rowNumber: parsed.rowNumber,
      values: row,
      parsed,
      issues,
      probableDuplicate: Boolean(duplicate),
      selected: issues.every((issue) => issue.severity !== "error") && !duplicate,
      fingerprint: rowHash,
    });
  }
  return previews;
}

function asImportInput(
  row: CsvParsedRow,
  accountId: number,
  categoryId: number | null,
  accountIdsByName: Map<string, number>,
): TransactionInput {
  if (!row.type || row.amount == null || row.date == null) {
    throw new Error(`La ligne ${row.rowNumber} est invalide.`);
  }
  if (row.type === "transfer") {
    const source = row.sourceAccountName ? accountIdsByName.get(normalizeHeader(row.sourceAccountName)) : null;
    const destination = row.destinationAccountName ? accountIdsByName.get(normalizeHeader(row.destinationAccountName)) : null;
    if (source == null || destination == null || source === destination) {
      throw new Error(`Les comptes du transfert de la ligne ${row.rowNumber} sont invalides.`);
    }
    return {
      type: "transfer",
      amount: row.amount,
      categoryId: null,
      accountId: source,
      destinationAccountId: destination,
      fee: null,
      note: row.note,
      merchant: row.merchant,
      tags: row.tags,
      transactionDate: row.date,
    };
  }
  return {
    type: row.type,
    amount: row.amount,
    categoryId,
    accountId,
    destinationAccountId: null,
    fee: null,
    note: row.note,
    merchant: row.merchant,
    tags: row.tags,
    transactionDate: row.date,
  };
}

export async function applyCsvImport(
  db: SQLiteDatabase,
  previews: CsvImportPreview[],
  options: CsvApplyOptions,
): Promise<CsvImportReport> {
  const batchFingerprint = fingerprint(
    `${options.sourceName ?? "csv"}|${previews.map((preview) => preview.fingerprint).join("|")}`,
  );
  const report: CsvImportReport = {
    batchId: 0,
    totalRows: previews.length,
    inserted: 0,
    skipped: 0,
    duplicates: 0,
    invalidRows: 0,
    unknownCategories: [],
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR IGNORE INTO import_batches (fingerprint, source_name, row_count, created_at)
       VALUES (?, ?, ?, ?)`,
      batchFingerprint,
      options.sourceName ?? null,
      previews.length,
      Date.now(),
    );
    report.batchId = Number(
      (await db.getFirstAsync<{ id: number }>("SELECT id FROM import_batches WHERE fingerprint = ?", batchFingerprint))?.id,
    );
    const categories = await db.getAllAsync<{ id: number; name: string; type: TransactionType }>(
      "SELECT id, name, type FROM categories WHERE type IN ('income', 'expense')",
    );
    const categoryByKey = new Map(categories.map((category) => [`${category.type}|${normalizeHeader(category.name)}`, category]));
    const accounts = await db.getAllAsync<{ id: number; name: string }>("SELECT id, name FROM accounts WHERE deleted_at IS NULL");
    const accountIdsByName = new Map(accounts.map((account) => [normalizeHeader(account.name), account.id]));
    for (const preview of previews) {
      if (!preview.selected) {
        report.skipped += 1;
        if (preview.probableDuplicate) report.duplicates += 1;
        if (preview.issues.some((issue) => issue.severity === "error")) report.invalidRows += 1;
        continue;
      }
      if (!preview.parsed || preview.issues.some((issue) => issue.severity === "error")) {
        report.invalidRows += 1;
        continue;
      }
      const category = preview.parsed.type && preview.parsed.categoryName
        ? categoryByKey.get(`${preview.parsed.type}|${normalizeHeader(preview.parsed.categoryName)}`)
        : null;
      if (preview.parsed.categoryName && !category && preview.parsed.type !== "transfer") {
        report.unknownCategories.push(preview.parsed.categoryName);
      }
      const input = asImportInput(preview.parsed, options.accountId, category?.id ?? null, accountIdsByName);
      const existingFingerprint = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM transactions WHERE import_fingerprint = ?",
        preview.fingerprint,
      );
      if (existingFingerprint) {
        report.skipped += 1;
        report.duplicates += 1;
        continue;
      }
      const transactionId = await insertJournalTransaction(db, input);
      await db.runAsync(
        `UPDATE transactions
         SET import_batch_id = ?, import_row_number = ?, import_fingerprint = ?
         WHERE id = ?`,
        report.batchId,
        preview.rowNumber,
        preview.fingerprint,
        transactionId,
      );
      report.inserted += 1;
    }
  });
  report.unknownCategories = [...new Set(report.unknownCategories)];
  return report;
}

export async function getImportBatch(
  db: SQLiteDatabase,
  id: number,
): Promise<ImportBatch | null> {
  return db.getFirstAsync<ImportBatch>(
    `SELECT id, fingerprint, source_name AS sourceName,
            row_count AS rowCount, created_at AS createdAt
     FROM import_batches WHERE id = ?`,
    id,
  );
}
