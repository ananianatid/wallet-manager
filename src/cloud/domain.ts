import type { CloudEntity } from "@/cloud/api";
import type { CategoryIconName, ReimbursementDirection, TransactionType } from "@/types";

export type CloudPayload = {
  fields?: Record<string, unknown>;
  refs?: Record<string, string | null>;
};

export function cloudFields(entity: CloudEntity): Record<string, unknown> {
  const payload = entity.payload as CloudPayload | null;
  return payload?.fields ?? entity.payload ?? {};
}

export function cloudRefs(entity: CloudEntity): Record<string, string | null> {
  const payload = entity.payload as CloudPayload | null;
  return payload?.refs ?? {};
}

export interface CloudCategory {
  entityId: string;
  type: "account" | "income" | "expense";
  name: string;
  icon: CategoryIconName | null;
  isSeed: boolean;
  version: number;
}

export function toCloudCategory(entity: CloudEntity): CloudCategory {
  const fields = cloudFields(entity);
  return {
    entityId: entity.entityId,
    type: String(fields.type ?? "expense") as CloudCategory["type"],
    name: String(fields.name ?? "Autre"),
    icon: (fields.icon as CategoryIconName | null | undefined) ?? "tag",
    isSeed: Boolean(fields.is_seed),
    version: entity.version,
  };
}

export interface CloudTransactionDraft {
  type: TransactionType;
  amount: number;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  destinationAmount: number | null;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  exchangeRateProvider: string | null;
  fee: number | null;
  merchant: string | null;
  note: string | null;
  transactionDate: number;
  tags?: string[];
  reimbursements?: { personName: string; direction: ReimbursementDirection; amount: number }[];
  allocations?: { categoryId: string; amount: number }[];
}

export function transactionPayload(input: CloudTransactionDraft): CloudPayload {
  return {
    fields: {
      type: input.type,
      amount: input.amount,
      destination_amount: input.destinationAmount,
      exchange_rate: input.exchangeRate,
      exchange_rate_date: input.exchangeRateDate,
      exchange_rate_provider: input.exchangeRateProvider,
      fee: input.fee,
      merchant: input.merchant,
      note: input.note,
      transaction_date: input.transactionDate,
      created_at: Date.now(),
      tags: input.tags ?? [],
      reimbursements: input.reimbursements ?? [],
      allocations: input.allocations ?? [],
    },
    refs: {
      account_id: input.accountId,
      destination_account_id: input.destinationAccountId,
      category_id: input.categoryId,
    },
  };
}
