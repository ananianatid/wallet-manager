import type { CategoryType, TransactionType } from "../types";

export interface MmAccountRow {
  uid: string;
  name: string | null;
  groupUid?: string | null;
}

export interface MmGroupRow {
  uid: string;
  name: string | null;
}

export interface MmCategoryRow {
  uid: string;
  name: string | null;
  type: number;
}

export interface MmTransactionRow {
  doType: number;
  money: number;
  date: number;
  note: string | null;
  categoryUid: string | null;
  accountUid: string | null;
  destinationUid: string | null;
}

export interface MoneyManagerData {
  accounts: MmAccountRow[];
  categories: MmCategoryRow[];
  transactions: MmTransactionRow[];
  groups?: MmGroupRow[];
}

export interface PlannedCategory {
  type: CategoryType;
  name: string;
}

export interface PlannedAccount {
  name: string;
  groupName: string | null;
}

export interface PlannedTransaction {
  type: TransactionType;
  amount: number;
  categoryName: string | null;
  accountName: string;
  destinationName: string | null;
  fee: number | null;
  note: string | null;
  date: number;
}

export interface ImportStats {
  accounts: number;
  categories: number;
  income: number;
  expense: number;
  transfer: number;
  feesMerged: number;
  feeOrphans: number;
  rangeStart: number | null;
  rangeEnd: number | null;
}

export interface ImportPlan {
  accounts: PlannedAccount[];
  categories: PlannedCategory[];
  transactions: PlannedTransaction[];
  stats: ImportStats;
}

export const MM_DO_INCOME = 0;
export const MM_DO_EXPENSE = 1;
export const MM_DO_TRANSFER = 3;
export const MM_DO_TRANSFER_MIRROR = 4;

const FEE_NOTE = "Frais";
const FEE_MATCH_MS = 60_000;
const FALLBACK_CATEGORY = "Autres";

export const IMPORT_ACCOUNT_CATEGORY = "Espèces";

const normalize = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
};

const mmType = (doType: number): "income" | "expense" | "transfer" => {
  if (doType === MM_DO_INCOME) return "income";
  if (doType === MM_DO_EXPENSE) return "expense";
  return "transfer";
};

export function buildImportPlan(data: MoneyManagerData): ImportPlan {
  const active = data.transactions
    .filter((row) => Number(row.doType) !== MM_DO_TRANSFER_MIRROR)
    .map((row) => ({
      ...row,
      doType: Number(row.doType),
      money: Number(row.money),
      date: Number(row.date),
    }));

  const usedAccountUids = new Set<string>();
  for (const row of active) {
    if (row.accountUid) {
      usedAccountUids.add(row.accountUid);
    }
    if (row.doType === MM_DO_TRANSFER && row.destinationUid) {
      usedAccountUids.add(row.destinationUid);
    }
  }

  const groupNameByUid = new Map<string, string | null>();
  for (const group of data.groups ?? []) {
    const name = normalize(group.name);
    if (name) {
      groupNameByUid.set(group.uid, name);
    }
  }

  const accountNames: string[] = [];
  const accountNameByUid = new Map<string, string>();
  const groupNameByAccountName = new Map<string, string | null>();
  const seenAccounts = new Set<string>();
  for (const account of data.accounts) {
    const name = normalize(account.name);
    if (!name || !usedAccountUids.has(account.uid)) {
      continue;
    }
    if (!seenAccounts.has(name)) {
      seenAccounts.add(name);
      accountNames.push(name);
      groupNameByAccountName.set(
        name,
        groupNameByUid.get(account.groupUid ?? "") ?? null,
      );
    }
    if (!accountNameByUid.has(account.uid)) {
      accountNameByUid.set(account.uid, name);
    }
  }
  accountNames.sort();

  const knownCategories = new Map<string, MmCategoryRow>();
  for (const category of data.categories) {
    knownCategories.set(category.uid, category);
  }

  const usageByUid = new Map<string, number>();
  for (const row of active) {
    if (row.categoryUid) {
      usageByUid.set(row.categoryUid, (usageByUid.get(row.categoryUid) ?? 0) + 1);
    }
  }

  const incomeCategoryNames = new Set<string>();
  const expenseCategoryNames = new Set<string>();
  for (const category of data.categories) {
    const name = normalize(category.name);
    if (!name || !(usageByUid.get(category.uid) ?? 0)) {
      continue;
    }
    if (category.type === 0) {
      incomeCategoryNames.add(name);
    } else {
      expenseCategoryNames.add(name);
    }
  }

  const transfers: { row: MmTransactionRow; fee: number | null }[] = [];
  const feeCandidates: MmTransactionRow[] = [];
  const plain: MmTransactionRow[] = [];

  for (const row of active) {
    if (row.doType === MM_DO_TRANSFER) {
      transfers.push({ row, fee: null });
    } else if (row.doType === MM_DO_EXPENSE && normalize(row.note) === FEE_NOTE) {
      feeCandidates.push(row);
    } else {
      plain.push(row);
    }
  }

  const feeOrphans: MmTransactionRow[] = [];
  for (const fee of feeCandidates) {
    let best: { index: number; diff: number } | null = null;
    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i];
      if (transfer.row.accountUid !== fee.accountUid || transfer.fee !== null) {
        continue;
      }
      const diff = Math.abs(transfer.row.date - fee.date);
      if (diff <= FEE_MATCH_MS && (best === null || diff < best.diff)) {
        best = { index: i, diff };
      }
    }
    if (best !== null) {
      const amount = Math.round(fee.money);
      if (amount > 0) {
        transfers[best.index].fee = amount;
        continue;
      }
    }
    feeOrphans.push(fee);
  }

  let needsIncomeFallback = false;
  let needsExpenseFallback = false;

  const resolveCategoryName = (
    row: MmTransactionRow,
    target: "income" | "expense",
  ): string => {
    const uid = row.categoryUid;
    const name = uid ? normalize(knownCategories.get(uid)?.name ?? null) : null;
    const pool = target === "income" ? incomeCategoryNames : expenseCategoryNames;
    if (name && pool.has(name)) {
      return name;
    }
    if (target === "income") {
      needsIncomeFallback = true;
    } else {
      needsExpenseFallback = true;
    }
    return FALLBACK_CATEGORY;
  };

  const planned: PlannedTransaction[] = [];

  const normalizeAmount = (
    row: MmTransactionRow,
  ): { type: TransactionType; amount: number; flipped: boolean } | null => {
    const raw = Math.round(row.money);
    if (raw === 0) {
      return null;
    }
    const type = mmType(row.doType);
    if (raw > 0) {
      return { type, amount: raw, flipped: false };
    }
    return { type, amount: -raw, flipped: true };
  };

  for (const row of plain) {
    const accountName = row.accountUid
      ? accountNameByUid.get(row.accountUid)
      : undefined;
    const normalized = normalizeAmount(row);
    if (!normalized || !accountName) {
      continue;
    }
    if (normalized.type === "transfer") {
      continue;
    }
    const target: "income" | "expense" = normalized.flipped
      ? normalized.type === "income"
        ? "expense"
        : "income"
      : normalized.type;
    planned.push({
      type: target,
      amount: normalized.amount,
      categoryName: resolveCategoryName(row, target),
      accountName,
      destinationName: null,
      fee: null,
      note: normalize(row.note),
      date: row.date,
    });
  }

  for (const transfer of transfers) {
    const accountName = transfer.row.accountUid
      ? accountNameByUid.get(transfer.row.accountUid)
      : undefined;
    const destinationName = transfer.row.destinationUid
      ? accountNameByUid.get(transfer.row.destinationUid)
      : undefined;
    const normalized = normalizeAmount(transfer.row);
    if (!normalized || !accountName || !destinationName) {
      continue;
    }
    planned.push({
      type: "transfer",
      amount: normalized.amount,
      categoryName: null,
      accountName,
      destinationName,
      fee: transfer.fee,
      note: normalize(transfer.row.note),
      date: transfer.row.date,
    });
  }

  for (const orphan of feeOrphans) {
    const accountName = orphan.accountUid
      ? accountNameByUid.get(orphan.accountUid)
      : undefined;
    const normalized = normalizeAmount(orphan);
    if (!normalized || !accountName) {
      continue;
    }
    planned.push({
      type: "expense",
      amount: normalized.amount,
      categoryName: resolveCategoryName(orphan, "expense"),
      accountName,
      destinationName: null,
      fee: null,
      note: normalize(orphan.note),
      date: orphan.date,
    });
  }

  planned.sort((a, b) => a.date - b.date);

  const categories: PlannedCategory[] = [];
  const seenCategories = new Set<string>();
  const pushCategory = (type: CategoryType, name: string) => {
    const key = `${type}|${name}`;
    if (!seenCategories.has(key)) {
      seenCategories.add(key);
      categories.push({ type, name });
    }
  };

  pushCategory("account", IMPORT_ACCOUNT_CATEGORY);
  for (const name of [...incomeCategoryNames].sort()) {
    pushCategory("income", name);
  }
  if (needsIncomeFallback) {
    pushCategory("income", FALLBACK_CATEGORY);
  }
  for (const name of [...expenseCategoryNames].sort()) {
    pushCategory("expense", name);
  }
  if (needsExpenseFallback) {
    pushCategory("expense", FALLBACK_CATEGORY);
  }

  const rangeStart =
    planned.length > 0 ? planned.reduce((min, tx) => Math.min(min, tx.date), planned[0].date) : null;
  const rangeEnd =
    planned.length > 0 ? planned.reduce((max, tx) => Math.max(max, tx.date), planned[0].date) : null;

  return {
    accounts: accountNames.map((name) => ({
      name,
      groupName: groupNameByAccountName.get(name) ?? null,
    })),
    categories,
    transactions: planned,
    stats: {
      accounts: accountNames.length,
      categories: categories.length,
      income: planned.filter((tx) => tx.type === "income").length,
      expense: planned.filter((tx) => tx.type === "expense").length,
      transfer: planned.filter((tx) => tx.type === "transfer").length,
      feesMerged: transfers.filter((t) => t.fee !== null).length,
      feeOrphans: feeOrphans.length,
      rangeStart,
      rangeEnd,
    },
  };
}
