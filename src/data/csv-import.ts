import { listAccountsByUsage } from "@/db/accounts";
import { getDatabase } from "@/db/database";
import {
  applyCsvImport,
  inferCsvMapping,
  parseCsvText,
  previewCsvImport,
  type ParsedCsvDocument,
} from "@/db/csv-import";

export { inferCsvMapping, parseCsvText };
export type { ParsedCsvDocument };

export function loadCsvAccounts() {
  return getDatabase().then(listAccountsByUsage);
}

export async function previewLocalCsvImport(content: string, options: Parameters<typeof previewCsvImport>[2]) {
  return previewCsvImport(await getDatabase(), content, options);
}

export async function applyLocalCsvImport(previews: Parameters<typeof applyCsvImport>[1], options: Parameters<typeof applyCsvImport>[2]) {
  return applyCsvImport(await getDatabase(), previews, options);
}
