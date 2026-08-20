import type { SQLiteDatabase } from "expo-sqlite";
import type {
  Person,
  Reimbursement,
  ReimbursementInput,
  ReimbursementSettlement,
  Tag,
  TransactionInput,
  TransactionSplit,
  TransactionSplitInput,
  TransactionDetail,
} from "@/types";

function relationError(message: string): Error {
  return new Error(message);
}

function validateAllocations(
  input: TransactionInput,
): TransactionSplitInput[] {
  const allocations = input.allocations ?? [];
  if (allocations.length === 0) {
    return [];
  }
  if (input.type === "transfer") {
    throw relationError("Un transfert ne peut pas être fractionné.");
  }
  let total = 0;
  for (const allocation of allocations) {
    if (!Number.isInteger(allocation.categoryId) || allocation.categoryId <= 0) {
      throw relationError("Chaque répartition doit avoir une catégorie valide.");
    }
    if (!Number.isInteger(allocation.amount) || allocation.amount <= 0) {
      throw relationError("Chaque répartition doit avoir un montant positif.");
    }
    total += allocation.amount;
  }
  if (total !== input.amount) {
    throw relationError(
      "La somme des répartitions doit être exactement égale au montant principal.",
    );
  }
  return allocations;
}

function validateReimbursements(
  input: TransactionInput,
): ReimbursementInput[] {
  const reimbursements = input.reimbursements ?? [];
  if (reimbursements.length === 0) {
    return [];
  }
  if (input.type !== "expense") {
    throw relationError("Un remboursement doit être rattaché à une dépense.");
  }
  let total = 0;
  for (const reimbursement of reimbursements) {
    if (!reimbursement.personId && !reimbursement.personName?.trim()) {
      throw relationError("Chaque remboursement doit avoir une personne.");
    }
    if (!Number.isInteger(reimbursement.amount) || reimbursement.amount <= 0) {
      throw relationError("Le montant du remboursement doit être positif.");
    }
    total += reimbursement.amount;
  }
  if (total > input.amount) {
    throw relationError(
      "Le total des remboursements ne peut pas dépasser la dépense.",
    );
  }
  return reimbursements;
}

async function resolvePerson(
  db: SQLiteDatabase,
  input: ReimbursementInput,
  now: number,
): Promise<number> {
  if (input.personId != null) {
    const person = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM people WHERE id = ?",
      input.personId,
    );
    if (!person) {
      throw relationError("La personne du remboursement est introuvable.");
    }
    return person.id;
  }
  const name = input.personName?.trim() ?? "";
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM people WHERE name = ? COLLATE NOCASE",
    name,
  );
  if (existing) {
    return existing.id;
  }
  const created = await db.runAsync(
    "INSERT INTO people (name, created_at) VALUES (?, ?)",
    name,
    now,
  );
  return Number(created.lastInsertRowId);
}

async function validateCategories(
  db: SQLiteDatabase,
  input: TransactionInput,
  allocations: TransactionSplitInput[],
): Promise<void> {
  const ids = allocations.length > 0
    ? allocations.map((allocation) => allocation.categoryId)
    : input.categoryId == null
      ? []
      : [input.categoryId];
  if (ids.length === 0) {
    return;
  }
  if (typeof db.getAllAsync !== "function") {
    return;
  }
  const placeholders = ids.map(() => "?").join(",");
  const rows = await db.getAllAsync<{ id: number; type: string }>(
    `SELECT id, type FROM categories WHERE id IN (${placeholders})`,
    ids,
  );
  if (rows.length !== new Set(ids).size) {
    throw relationError("Une catégorie de la transaction est introuvable.");
  }
  if (rows.some((row) => row.type !== input.type)) {
    throw relationError("Les catégories doivent correspondre au type de transaction.");
  }
}

export async function validateJournalRelations(
  db: SQLiteDatabase,
  input: TransactionInput,
): Promise<{ allocations: TransactionSplitInput[]; reimbursements: ReimbursementInput[]; tags: string[] }> {
  const allocations = validateAllocations(input);
  const reimbursements = validateReimbursements(input);
  await validateCategories(db, input, allocations);
  const tags = [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  return { allocations, reimbursements, tags };
}

async function replaceTransactionTags(
  db: SQLiteDatabase,
  transactionId: number,
  tags: string[],
  now: number,
): Promise<void> {
  await db.runAsync("DELETE FROM transaction_tags WHERE transaction_id = ?", transactionId);
  for (const name of tags) {
    await db.runAsync(
      "INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)",
      name,
      now,
    );
    const tag = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM tags WHERE name = ? COLLATE NOCASE",
      name,
    );
    if (!tag) {
      throw relationError("Le tag n'a pas pu être enregistré.");
    }
    await db.runAsync(
      `INSERT OR IGNORE INTO transaction_tags
         (transaction_id, tag_id, created_at)
       VALUES (?, ?, ?)`,
      transactionId,
      tag.id,
      now,
    );
  }
}

export async function listTags(db: SQLiteDatabase): Promise<Tag[]> {
  return db.getAllAsync<Tag>(
    "SELECT id, name, created_at AS createdAt FROM tags ORDER BY name COLLATE NOCASE",
  );
}

export async function listTransactionTags(
  db: SQLiteDatabase,
  transactionId: number,
): Promise<Tag[]> {
  return db.getAllAsync<Tag>(
    `SELECT t.id, t.name, t.created_at AS createdAt
     FROM tags t
     JOIN transaction_tags tt ON tt.tag_id = t.id
     WHERE tt.transaction_id = ?
     ORDER BY t.name COLLATE NOCASE`,
    transactionId,
  );
}

export async function insertJournalTransaction(
  db: SQLiteDatabase,
  input: TransactionInput,
  now = Date.now(),
): Promise<number> {
  const { allocations, reimbursements, tags } = await validateJournalRelations(db, input);
  const result = await db.runAsync(
    `INSERT INTO transactions
       (type, amount, category_id, account_id, destination_account_id, fee,
        note, transaction_date, created_at, destination_amount, exchange_rate,
        exchange_rate_date, exchange_rate_provider, merchant)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.type,
    input.amount,
    allocations.length > 0 ? null : input.categoryId,
    input.accountId,
    input.destinationAccountId,
    input.fee,
    input.note,
    input.transactionDate,
    now,
    input.destinationAmount ?? null,
    input.exchangeRate ?? null,
    input.exchangeRateDate ?? null,
    input.exchangeRateProvider ?? null,
    input.merchant?.trim() || null,
  );
  const transactionId = Number(result.lastInsertRowId);
  for (const allocation of allocations) {
    await db.runAsync(
      `INSERT INTO transaction_splits
         (transaction_id, category_id, amount, created_at)
       VALUES (?, ?, ?, ?)`,
      transactionId,
      allocation.categoryId,
      allocation.amount,
      now,
    );
  }
  for (const reimbursement of reimbursements) {
    const personId = await resolvePerson(db, reimbursement, now);
    await db.runAsync(
      `INSERT INTO reimbursements
         (transaction_id, person_id, direction, amount, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      transactionId,
      personId,
      reimbursement.direction,
      reimbursement.amount,
      reimbursement.note?.trim() || null,
      now,
    );
  }
  await replaceTransactionTags(db, transactionId, tags, now);
  return transactionId;
}

export async function createJournalTransaction(
  db: SQLiteDatabase,
  input: TransactionInput,
): Promise<number> {
  let id = 0;
  if (typeof db.withTransactionAsync === "function") {
    await db.withTransactionAsync(async () => {
      id = await insertJournalTransaction(db, input);
    });
  } else {
    id = await insertJournalTransaction(db, input);
  }
  return id;
}

async function assertTransactionCanChange(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  const settlement = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM reimbursement_settlements
     WHERE settlement_transaction_id = ?
     LIMIT 1`,
    id,
  );
  if (settlement) {
    throw relationError("Un règlement enregistré ne peut plus être modifié.");
  }
  const settledDebt = await db.getFirstAsync<{ id: number }>(
    `SELECT r.id
     FROM reimbursements r
     JOIN reimbursement_settlements rs ON rs.reimbursement_id = r.id
     WHERE r.transaction_id = ?
     LIMIT 1`,
    id,
  );
  if (settledDebt) {
    throw relationError("Une dette déjà réglée ne peut plus être modifiée.");
  }
}

export async function updateJournalTransaction(
  db: SQLiteDatabase,
  id: number,
  input: TransactionInput,
): Promise<void> {
  await assertTransactionCanChange(db, id);
  await db.withTransactionAsync(async () => {
    const { allocations, reimbursements, tags } = await validateJournalRelations(db, input);
    const result = await db.runAsync(
      `UPDATE transactions SET
         type = ?, amount = ?, category_id = ?, account_id = ?,
         destination_account_id = ?, fee = ?, destination_amount = ?,
         exchange_rate = ?, exchange_rate_date = ?, exchange_rate_provider = ?,
         note = ?, merchant = ?, transaction_date = ?
       WHERE id = ?`,
      input.type,
      input.amount,
      allocations.length > 0 ? null : input.categoryId,
      input.accountId,
      input.destinationAccountId,
      input.fee,
      input.destinationAmount ?? null,
      input.exchangeRate ?? null,
      input.exchangeRateDate ?? null,
      input.exchangeRateProvider ?? null,
      input.note,
      input.merchant?.trim() || null,
      input.transactionDate,
      id,
    );
    if (Number(result.changes) !== 1) {
      throw relationError("La transaction à modifier est introuvable.");
    }
    await db.runAsync("DELETE FROM transaction_splits WHERE transaction_id = ?", id);
    await db.runAsync("DELETE FROM reimbursements WHERE transaction_id = ?", id);
    await replaceTransactionTags(db, id, tags, Date.now());
    for (const allocation of allocations) {
      await db.runAsync(
        `INSERT INTO transaction_splits
           (transaction_id, category_id, amount, created_at)
         VALUES (?, ?, ?, ?)`,
        id,
        allocation.categoryId,
        allocation.amount,
        Date.now(),
      );
    }
    for (const reimbursement of reimbursements) {
      const personId = await resolvePerson(db, reimbursement, Date.now());
      await db.runAsync(
        `INSERT INTO reimbursements
           (transaction_id, person_id, direction, amount, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        id,
        personId,
        reimbursement.direction,
        reimbursement.amount,
        reimbursement.note?.trim() || null,
        Date.now(),
      );
    }
  });
}

export async function deleteJournalTransaction(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await assertTransactionCanChange(db, id);
  await db.runAsync("DELETE FROM transactions WHERE id = ?", id);
}

export async function listTransactionSplits(
  db: SQLiteDatabase,
  transactionId: number,
): Promise<TransactionSplit[]> {
  const rows = await db.getAllAsync<TransactionSplit>(
    `SELECT s.id,
            s.transaction_id AS transactionId,
            s.category_id AS categoryId,
            c.name AS categoryName,
            s.amount,
            s.created_at AS createdAt
     FROM transaction_splits s
     LEFT JOIN categories c ON c.id = s.category_id
     WHERE s.transaction_id = ?
     ORDER BY s.id`,
    transactionId,
  );
  return rows;
}

export async function listPeople(db: SQLiteDatabase): Promise<Person[]> {
  const rows = await db.getAllAsync<Person>(
    `SELECT id, name, created_at AS createdAt
     FROM people ORDER BY name COLLATE NOCASE`,
  );
  return rows;
}

export async function listReimbursementsForTransaction(
  db: SQLiteDatabase,
  transactionId: number,
): Promise<Reimbursement[]> {
  const rows = await db.getAllAsync<Reimbursement & { settledAmount: number }>(
    `SELECT r.id,
            r.transaction_id AS transactionId,
            r.person_id AS personId,
            p.name AS personName,
            r.direction,
            r.amount,
            COALESCE(SUM(rs.amount), 0) AS settledAmount,
            r.note,
            r.created_at AS createdAt
     FROM reimbursements r
     JOIN people p ON p.id = r.person_id
     LEFT JOIN reimbursement_settlements rs ON rs.reimbursement_id = r.id
     WHERE r.transaction_id = ?
     GROUP BY r.id
     ORDER BY r.id`,
    transactionId,
  );
  const settlements = await db.getAllAsync<ReimbursementSettlement>(
    `SELECT rs.id,
            rs.reimbursement_id AS reimbursementId,
            rs.settlement_transaction_id AS settlementTransactionId,
            rs.amount,
            rs.created_at AS createdAt
     FROM reimbursement_settlements rs
     JOIN reimbursements r ON r.id = rs.reimbursement_id
     WHERE r.transaction_id = ?
     ORDER BY rs.id`,
    transactionId,
  );
  return rows.map((row) => ({
    ...row,
    remainingAmount: row.amount - row.settledAmount,
    settlements: settlements.filter((settlement) => settlement.reimbursementId === row.id),
  }));
}

export async function getReimbursement(
  db: SQLiteDatabase,
  reimbursementId: number,
): Promise<Reimbursement | null> {
  const transaction = await db.getFirstAsync<{ transactionId: number }>(
    "SELECT transaction_id AS transactionId FROM reimbursements WHERE id = ?",
    reimbursementId,
  );
  if (!transaction) {
    return null;
  }
  const reimbursements = await listReimbursementsForTransaction(db, transaction.transactionId);
  return reimbursements.find((reimbursement) => reimbursement.id === reimbursementId) ?? null;
}

export async function getJournalRelations(
  db: SQLiteDatabase,
  transactionId: number,
): Promise<Pick<TransactionDetail, "splits" | "reimbursements" | "tags">> {
  const [splits, reimbursements, tags] = await Promise.all([
    listTransactionSplits(db, transactionId),
    listReimbursementsForTransaction(db, transactionId),
    listTransactionTags(db, transactionId),
  ]);
  return { splits, reimbursements, tags };
}

export async function settleReimbursement(
  db: SQLiteDatabase,
  reimbursementId: number,
  amount: number,
  transaction: TransactionInput,
): Promise<{ transactionId: number; settlementId: number }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw relationError("Le montant du règlement doit être un entier positif.");
  }
  if ((transaction.allocations?.length ?? 0) > 0 || (transaction.reimbursements?.length ?? 0) > 0) {
    throw relationError("Un règlement doit être une transaction normale sans dette imbriquée.");
  }
  let result: { transactionId: number; settlementId: number } | null = null;
  await db.withTransactionAsync(async () => {
    const debt = await db.getFirstAsync<{ amount: number; settledAmount: number }>(
      `SELECT r.amount, COALESCE(SUM(rs.amount), 0) AS settledAmount
       FROM reimbursements r
       LEFT JOIN reimbursement_settlements rs ON rs.reimbursement_id = r.id
       WHERE r.id = ?
       GROUP BY r.id`,
      reimbursementId,
    );
    if (!debt) {
      throw relationError("La dette à régler est introuvable.");
    }
    const remaining = debt.amount - debt.settledAmount;
    if (amount > remaining) {
      throw relationError("Le règlement dépasse le solde restant dû.");
    }
    const transactionId = await insertJournalTransaction(db, transaction);
    const settlement = await db.runAsync(
      `INSERT INTO reimbursement_settlements
         (reimbursement_id, settlement_transaction_id, amount, created_at)
       VALUES (?, ?, ?, ?)`,
      reimbursementId,
      transactionId,
      amount,
      Date.now(),
    );
    result = { transactionId, settlementId: Number(settlement.lastInsertRowId) };
  });
  if (!result) {
    throw relationError("Le règlement n'a pas pu être enregistré.");
  }
  return result;
}
