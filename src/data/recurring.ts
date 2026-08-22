import { listAccountsByUsage } from "@/db/accounts";
import { listCategories } from "@/db/categories";
import { getDatabase } from "@/db/database";
import {
  applyDueRecurring, approveRecurringOccurrence, createRecurring, deleteRecurring,
  getRecurring, listPendingRecurringOccurrences, listRecurring, rescheduleRecurringOccurrence,
  skipRecurringOccurrence, updateRecurring,
} from "@/db/recurring";
import { schedulePendingRecurringNotifications } from "@/services/recurring-notifications";
import type { RecurringTransactionInput } from "@/types";

export async function loadRecurringSnapshot() {
  const db = await getDatabase();
  await applyDueRecurring(db);
  await schedulePendingRecurringNotifications(db);
  const [rules, pending] = await Promise.all([listRecurring(db), listPendingRecurringOccurrences(db)]);
  return { rules, pending };
}
export async function deleteLocalRecurring(id: number) { await deleteRecurring(await getDatabase(), id); }
export async function generateRecurringNow() { const db = await getDatabase(); await applyDueRecurring(db); await schedulePendingRecurringNotifications(db); }
export async function approveLocalRecurringOccurrence(id: number) { await approveRecurringOccurrence(await getDatabase(), id); }
export async function skipLocalRecurringOccurrence(id: number) { await skipRecurringOccurrence(await getDatabase(), id); }
export async function rescheduleLocalRecurringOccurrence(id: number, date: number) { await rescheduleRecurringOccurrence(await getDatabase(), id, date); }

export async function loadRecurringForm(id: number | null) {
  const db = await getDatabase();
  const [accounts, categories, existing] = await Promise.all([
    listAccountsByUsage(db), listCategories(db), id ? getRecurring(db, id) : Promise.resolve(null),
  ]);
  return { accounts, categories, existing };
}
export async function saveLocalRecurring(id: number | null, input: RecurringTransactionInput) {
  const db = await getDatabase();
  if (id) await updateRecurring(db, id, input); else await createRecurring(db, input);
}
