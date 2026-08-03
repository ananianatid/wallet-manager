import type { SQLiteDatabase } from "expo-sqlite";
import type { ImportPlan } from "./money-manager";

export interface ImportReport {
  accountsCreated: number;
  categoriesAdded: number;
  categoriesRemoved: number;
  transactionsInserted: number;
  transactionsSkipped: number;
}

const transactionKey = (tx: {
  type: string;
  amount: number;
  accountId: number;
  categoryId: number | null;
  destinationAccountId: number | null;
  fee: number | null;
  note: string | null;
  transactionDate: number;
}): string =>
  [
    tx.type,
    tx.amount,
    tx.accountId,
    tx.destinationAccountId ?? "",
    tx.categoryId ?? "",
    tx.fee ?? "",
    tx.note ?? "",
    tx.transactionDate,
  ].join("|");

export async function applyImportPlan(
  db: SQLiteDatabase,
  plan: ImportPlan,
): Promise<ImportReport> {
  const now = Date.now();
  const report: ImportReport = {
    accountsCreated: 0,
    categoriesAdded: 0,
    categoriesRemoved: 0,
    transactionsInserted: 0,
    transactionsSkipped: 0,
  };

  await db.withTransactionAsync(async () => {
    const categoryIds = new Map<string, number>();
    for (const category of plan.categories) {
      const key = `${category.type}|${category.name}`;
      const existing = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM categories WHERE type = ? AND name = ?",
        category.type,
        category.name,
      );
      if (existing) {
        categoryIds.set(key, existing.id);
        continue;
      }
      const result = await db.runAsync(
        "INSERT INTO categories (type, name, is_seed) VALUES (?, ?, 0)",
        category.type,
        category.name,
      );
      categoryIds.set(key, Number(result.lastInsertRowId));
      report.categoriesAdded += 1;
    }

    const plannedIds = [...categoryIds.values()];
    if (plannedIds.length > 0) {
      const placeholders = plannedIds.map(() => "?").join(",");
      const removed = await db.runAsync(
        `DELETE FROM categories
         WHERE id NOT IN (${placeholders})
           AND id NOT IN (SELECT category_id FROM accounts WHERE category_id IS NOT NULL)
           AND id NOT IN (SELECT category_id FROM transactions WHERE category_id IS NOT NULL)`,
        ...plannedIds,
      );
      report.categoriesRemoved = Number(removed.changes);
    }

    const existingAccounts = await db.getAllAsync<{
      id: number;
      name: string;
    }>("SELECT id, name FROM accounts");
    const accountIdsByName = new Map(
      existingAccounts.map((account) => [account.name.trim(), account.id]),
    );
    for (const account of plan.accounts) {
      if (accountIdsByName.has(account.name)) {
        continue;
      }
      const classCategoryId = categoryIds.get(`account|${account.name}`);
      const result = await db.runAsync(
        "INSERT INTO accounts (name, category_id, created_at) VALUES (?, ?, ?)",
        account.name,
        classCategoryId ?? null,
        now,
      );
      accountIdsByName.set(account.name, Number(result.lastInsertRowId));
      report.accountsCreated += 1;
    }

    const existingTransactions = await db.getAllAsync<{
      type: string;
      amount: number;
      accountId: number;
      categoryId: number | null;
      destinationAccountId: number | null;
      fee: number | null;
      note: string | null;
      transactionDate: number;
    }>(
      `SELECT type,
              amount,
              account_id AS accountId,
              category_id AS categoryId,
              destination_account_id AS destinationAccountId,
              fee,
              note,
              transaction_date AS transactionDate
       FROM transactions`,
    );
    const existingKeys = new Set(existingTransactions.map(transactionKey));

    for (const tx of plan.transactions) {
      const accountId = accountIdsByName.get(tx.accountName);
      if (accountId == null) {
        continue;
      }
      let destinationAccountId: number | null = null;
      if (tx.destinationName != null) {
        const id = accountIdsByName.get(tx.destinationName);
        if (id == null) {
          continue;
        }
        destinationAccountId = id;
      }
      const categoryId = tx.categoryName
        ? (categoryIds.get(`${tx.type}|${tx.categoryName}`) ?? null)
        : null;

      const key = transactionKey({
        type: tx.type,
        amount: tx.amount,
        accountId,
        categoryId,
        destinationAccountId,
        fee: tx.fee,
        note: tx.note,
        transactionDate: tx.date,
      });
      if (existingKeys.has(key)) {
        report.transactionsSkipped += 1;
        continue;
      }

      await db.runAsync(
        `INSERT INTO transactions
           (type, amount, category_id, account_id, destination_account_id, fee, note, transaction_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        tx.type,
        tx.amount,
        categoryId,
        accountId,
        destinationAccountId,
        tx.fee,
        tx.note,
        tx.date,
        now,
      );
      report.transactionsInserted += 1;
    }
  });

  return report;
}
