import { createTransactionAttachment, deleteTransactionAttachment, listTransactionAttachments } from "@/db/attachments";
import { getDatabase } from "@/db/database";
import { getTransactionDetail } from "@/db/transactions";
import { getReimbursement, settleReimbursement } from "@/db/journal";
import { listAccountsByUsage } from "@/db/accounts";
import { listCategories } from "@/db/categories";
import type { TransactionInput, TransactionType } from "@/types";

export function loadLocalTransactionDetail(id: number) { return getDatabase().then((db) => getTransactionDetail(db, id)); }
export function loadLocalTransactionAttachments(id: number) { return getDatabase().then((db) => listTransactionAttachments(db, id)); }
export async function addLocalTransactionAttachment(id: number, uri: string, name: string, mimeType: string) { await createTransactionAttachment(await getDatabase(), id, uri, name, mimeType); }
export async function removeLocalTransactionAttachment(id: number) { await deleteTransactionAttachment(await getDatabase(), id); }

export async function loadReimbursementSettlement(id: number) {
  const db = await getDatabase();
  const reimbursement = await getReimbursement(db, id);
  if (!reimbursement) return null;
  const type: TransactionType = reimbursement.direction === "owed_to_me" ? "income" : "expense";
  const [accounts, categories] = await Promise.all([listAccountsByUsage(db), listCategories(db, type)]);
  return { reimbursement, accounts, categories, type };
}

export async function settleLocalReimbursement(id: number, amount: number, input: TransactionInput) {
  await settleReimbursement(await getDatabase(), id, amount, input);
}
