import {
  createAccount,
  deleteAccount,
  getAccount,
  getAccountBalance,
  getAccountAvailableBalance,
  listAccounts,
  listAccountsByUsage,
  restoreAccount,
  updateAccountFlags,
} from "./accounts";
import { listCategories } from "./categories";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  listTransactionsByAccount,
  listTransactionsByMonth,
  listTransactionYears,
  searchTransactions,
  searchTransactionsByText,
  updateTransaction,
} from "./transactions";
import { createTestDb, TestSqliteDatabase } from "@/test-utils/in-memory-db";
import type { SQLiteDatabase } from "expo-sqlite";
import type { TransactionInput } from "@/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 2, 10, 12, 0, 0);

async function income(
  db: SQLiteDatabase,
  accountId: number,
  amount: number,
  overrides: Partial<TransactionInput> = {},
): Promise<number> {
  const categories = await listCategories(db, "income");
  const salaire = categories.find((c) => c.name === "Salaire")!;
  return createTransaction(db, {
    type: "income",
    amount,
    categoryId: salaire.id,
    accountId,
    destinationAccountId: null,
    fee: null,
    note: null,
    transactionDate: NOW,
    ...overrides,
  });
}

async function expense(
  db: SQLiteDatabase,
  accountId: number,
  amount: number,
  overrides: Partial<TransactionInput> = {},
): Promise<number> {
  const categories = await listCategories(db, "expense");
  const nourriture = categories.find((c) => c.name === "Nourriture")!;
  return createTransaction(db, {
    type: "expense",
    amount,
    categoryId: nourriture.id,
    accountId,
    destinationAccountId: null,
    fee: null,
    note: null,
    transactionDate: NOW,
    ...overrides,
  });
}

describe("transactions integration (real SQLite)", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await (db as unknown as TestSqliteDatabase).closeAsync();
  });

  describe("getAccountBalance", () => {
    it("orders accounts by transaction usage with a name tie-breaker", async () => {
      const frequent = await createAccount(db, {
        name: "Compte fréquent",
        groupId: null,
      });
      const tieB = await createAccount(db, {
        name: "Compte B",
        groupId: null,
      });
      const tieA = await createAccount(db, {
        name: "Compte A",
        groupId: null,
      });
      const unused = await createAccount(db, {
        name: "Compte vide",
        groupId: null,
      });

      await income(db, frequent, 100);
      await expense(db, frequent, 50);
      await income(db, tieB, 100);
      await expense(db, tieA, 50);
      await createTransaction(db, {
        type: "transfer",
        amount: 25,
        categoryId: null,
        accountId: frequent,
        destinationAccountId: unused,
        fee: null,
        note: null,
        transactionDate: NOW,
      });

      const ordered = await listAccountsByUsage(db);
      expect(ordered.map((account) => account.id)).toEqual([
        frequent,
        tieA,
        tieB,
        unused,
      ]);
    });

    it("computes income, expense and transfer-with-fee against real rows", async () => {
      const source = await createAccount(db, {
        name: "Banque A",
        groupId: null,
      });
      const destination = await createAccount(db, {
        name: "Banque B",
        groupId: null,
      });

      await income(db, source, 1500);
      await expense(db, source, 300);
      await createTransaction(db, {
        type: "transfer",
        amount: 200,
        categoryId: null,
        accountId: source,
        destinationAccountId: destination,
        fee: 50,
        note: "Virement",
        transactionDate: NOW,
      });

      expect(await getAccountBalance(db, source)).toBe(950);
      expect(await getAccountBalance(db, destination)).toBe(200);

      const accounts = await listAccounts(db);
      const a = accounts.find((account) => account.id === source)!;
      const b = accounts.find((account) => account.id === destination)!;
      expect(a.balance).toBe(950);
      expect(b.balance).toBe(200);
      expect(a.reservedAmount).toBe(0);
      expect(a.availableBalance).toBe(950);
    });

    it("ignore les opérations futures dans le solde réel du compte", async () => {
      const accountId = await createAccount(db, {
        name: "Compte futur",
        groupId: null,
      });
      await income(db, accountId, 75_000, {
        transactionDate: Date.now() + DAY,
      });

      expect(await getAccountBalance(db, accountId)).toBe(0);
      expect(await getAccountAvailableBalance(db, accountId)).toBe(0);
      expect((await listAccounts(db)).find((account) => account.id === accountId)).toMatchObject({
        balance: 0,
        availableBalance: 0,
      });
    });

    it("masque les opérations futures de l'historique du compte", async () => {
      const accountId = await createAccount(db, {
        name: "Historique réel",
        groupId: null,
      });
      await income(db, accountId, 25_000, {
        transactionDate: Date.now() - DAY,
      });
      await income(db, accountId, 75_000, {
        transactionDate: Date.now() + DAY,
      });

      const rows = await listTransactionsByAccount(db, accountId);

      expect(rows).toHaveLength(1);
      expect(rows[0].amount).toBe(25_000);
    });

    it("returns zero for an account without transactions", async () => {
      const accountId = await createAccount(db, {
        name: "Vide",
        groupId: null,
      });
      expect(await getAccountBalance(db, accountId)).toBe(0);
      expect(await getAccountAvailableBalance(db, accountId)).toBe(0);
    });

    it("applies the destination amount for multi-currency transfers", async () => {
      const xof = await createAccount(db, {
        name: "XOF",
        groupId: null,
        currencyCode: "XOF",
      });
      const usd = await createAccount(db, {
        name: "USD",
        groupId: null,
        currencyCode: "USD",
      });

      await createTransaction(db, {
        type: "transfer",
        amount: 10_000,
        categoryId: null,
        accountId: xof,
        destinationAccountId: usd,
        fee: 100,
        destinationAmount: 1600,
        exchangeRate: 0.16,
        note: "Devise",
        transactionDate: NOW,
      });

      expect(await getAccountBalance(db, xof)).toBe(-10_100);
      expect(await getAccountBalance(db, usd)).toBe(1600);
    });

    it("keeps balances of deleted accounts and excludes their transactions", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      const b = await createAccount(db, { name: "B", groupId: null });
      await income(db, a, 500);
      await income(db, b, 300);
      await createTransaction(db, {
        type: "transfer",
        amount: 100,
        categoryId: null,
        accountId: a,
        destinationAccountId: b,
        fee: null,
        note: null,
        transactionDate: NOW,
      });

      await deleteAccount(db, a);

      const accounts = await listAccounts(db);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe(b);
      expect(accounts[0].balance).toBe(300);
      expect(await getAccount(db, a)).toBeNull();

      const transactions = await listTransactions(db);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].accountId).toBe(b);
      expect(transactions[0].amount).toBe(300);

      await restoreAccount(db, a);
      expect((await getAccount(db, a))!.balance).toBe(400);
      expect(await listTransactions(db)).toHaveLength(3);
    });
  });

  describe("createTransaction validation", () => {
    it("rejects non-positive or non-integer amounts", async () => {
      const accountId = await createAccount(db, { name: "A", groupId: null });
      await expect(income(db, accountId, 0)).rejects.toThrow(
        "Le montant doit être un entier strictement positif.",
      );
      await expect(income(db, accountId, 1.5)).rejects.toThrow(
        "Le montant doit être un entier strictement positif.",
      );
    });

    it("rejects income/expense without a category", async () => {
      const accountId = await createAccount(db, { name: "A", groupId: null });
      await expect(
        createTransaction(db, {
          type: "expense",
          amount: 100,
          categoryId: null,
          accountId,
          destinationAccountId: null,
          fee: null,
          note: null,
          transactionDate: NOW,
        }),
      ).rejects.toThrow("Une catégorie est requise pour ce type de transaction.");
    });

    it("rejects transfers to the same account", async () => {
      const accountId = await createAccount(db, { name: "A", groupId: null });
      await expect(
        createTransaction(db, {
          type: "transfer",
          amount: 100,
          categoryId: null,
          accountId,
          destinationAccountId: accountId,
          fee: null,
          note: null,
          transactionDate: NOW,
        }),
      ).rejects.toThrow(
        "Le compte de destination doit différer du compte source.",
      );
    });

    it("rejects invalid fees", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      const b = await createAccount(db, { name: "B", groupId: null });
      for (const fee of [0, -5, 2.5]) {
        await expect(
          createTransaction(db, {
            type: "transfer",
            amount: 100,
            categoryId: null,
            accountId: a,
            destinationAccountId: b,
            fee,
            note: null,
            transactionDate: NOW,
          }),
        ).rejects.toThrow("Les frais doivent être un entier strictement positif.");
      }
    });

    it("rejects transfers to an unknown account", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      await expect(
        createTransaction(db, {
          type: "transfer",
          amount: 100,
          categoryId: null,
          accountId: a,
          destinationAccountId: 9999,
          fee: null,
          note: null,
          transactionDate: NOW,
        }),
      ).rejects.toThrow("Le compte de transfert est introuvable.");
    });

    it("requires the credited amount for multi-currency transfers", async () => {
      const xof = await createAccount(db, {
        name: "XOF",
        groupId: null,
        currencyCode: "XOF",
      });
      const usd = await createAccount(db, {
        name: "USD",
        groupId: null,
        currencyCode: "USD",
      });
      await expect(
        createTransaction(db, {
          type: "transfer",
          amount: 100,
          categoryId: null,
          accountId: xof,
          destinationAccountId: usd,
          fee: null,
          destinationAmount: null,
          exchangeRate: null,
          note: null,
          transactionDate: NOW,
        }),
      ).rejects.toThrow(
        "Le montant crédité est requis pour un transfert multidevise.",
      );
    });

    it("requires a positive rate for multi-currency transfers", async () => {
      const xof = await createAccount(db, {
        name: "XOF",
        groupId: null,
        currencyCode: "XOF",
      });
      const usd = await createAccount(db, {
        name: "USD",
        groupId: null,
        currencyCode: "USD",
      });
      await expect(
        createTransaction(db, {
          type: "transfer",
          amount: 100,
          categoryId: null,
          accountId: xof,
          destinationAccountId: usd,
          fee: null,
          destinationAmount: 16,
          exchangeRate: 0,
          note: null,
          transactionDate: NOW,
        }),
      ).rejects.toThrow(
        "Le taux de change est requis pour un transfert multidevise.",
      );
    });

    it("defaults same-currency transfers to identity rate and amount", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      const b = await createAccount(db, { name: "B", groupId: null });
      const id = await createTransaction(db, {
        type: "transfer",
        amount: 750,
        categoryId: null,
        accountId: a,
        destinationAccountId: b,
        fee: null,
        note: null,
        transactionDate: NOW,
      });

      const transaction = await getTransaction(db, id);
      expect(transaction!.destinationAmount).toBe(750);
      expect(transaction!.exchangeRate).toBe(1);
      expect(transaction!.exchangeRateProvider).toBe("same currency");
      expect(transaction!.exchangeRateDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(transaction!.categoryId).toBeNull();
      expect(transaction!.categoryName).toBeNull();
    });
  });

  describe("CRUD", () => {
    it("updates and deletes transactions", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      const id = await income(db, a, 1000);

      await updateTransaction(db, id, {
        type: "expense",
        amount: 250,
        categoryId: (await listCategories(db, "expense"))[0].id,
        accountId: a,
        destinationAccountId: null,
        fee: null,
        note: "Modifié",
        transactionDate: NOW + DAY,
      });

      const updated = await getTransaction(db, id);
      expect(updated!.type).toBe("expense");
      expect(updated!.amount).toBe(250);
      expect(updated!.note).toBe("Modifié");
      expect(updated!.transactionDate).toBe(NOW + DAY);

      await deleteTransaction(db, id);
      expect(await getTransaction(db, id)).toBeNull();
      expect(await getAccountBalance(db, a)).toBe(0);
    });

    it("lists transactions of an account on both sides of a transfer", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      const b = await createAccount(db, { name: "B", groupId: null });
      await createTransaction(db, {
        type: "transfer",
        amount: 500,
        categoryId: null,
        accountId: a,
        destinationAccountId: b,
        fee: 10,
        note: "Virement",
        transactionDate: NOW,
      });

      const fromA = await listTransactionsByAccount(db, a);
      const fromB = await listTransactionsByAccount(db, b);
      expect(fromA).toHaveLength(1);
      expect(fromB).toHaveLength(1);
      expect(fromA[0].destinationAccountId).toBe(b);
      expect(fromA[0].destinationAccountName).toBe("B");
      expect(fromA[0].fee).toBe(10);
    });

    it("returns null for an unknown transaction", async () => {
      expect(await getTransaction(db, 12345)).toBeNull();
    });

    it("maps category icons and default destination amounts", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      const id = await income(db, a, 100, { note: "   " });
      const transaction = await getTransaction(db, id);
      expect(transaction!.note).toBeNull();
      expect(transaction!.categoryIcon).toBeTruthy();
    });
  });

  describe("searchTransactions against real rows", () => {
    it("matches notes, categories and account names with LIKE escaping", async () => {
      const a = await createAccount(db, { name: "Banque A", groupId: null });
      const b = await createAccount(db, { name: "Banque B", groupId: null });
      await expense(db, a, 1000, { note: "100% solde" });
      await expense(db, b, 2000, { note: "a_b" });
      await expense(db, b, 3000, { note: "axb" });

      const byPercent = await searchTransactions(db, {
        query: "100%",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: ["income", "expense", "transfer"],
        categoryIds: null,
      });
      expect(byPercent).toHaveLength(1);
      expect(byPercent[0].note).toBe("100% solde");

      const byUnderscore = await searchTransactions(db, {
        query: "a_b",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: ["income", "expense", "transfer"],
        categoryIds: null,
      });
      expect(byUnderscore).toHaveLength(1);
      expect(byUnderscore[0].note).toBe("a_b");

      const byAccount = await searchTransactions(db, {
        query: "Banque A",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: ["income", "expense", "transfer"],
        categoryIds: null,
      });
      expect(byAccount).toHaveLength(1);

      const byAmount = await searchTransactions(db, {
        query: "3000",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: ["income", "expense", "transfer"],
        categoryIds: null,
      });
      expect(byAmount).toHaveLength(1);
      expect(byAmount[0].amount).toBe(3000);
    });

    it("filters by dates, amounts, accounts and types", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      const b = await createAccount(db, { name: "B", groupId: null });
      await income(db, a, 50_000, { transactionDate: NOW - 2 * DAY });
      await income(db, a, 80_000, { transactionDate: NOW - DAY });
      await expense(db, b, 20_000, { transactionDate: NOW - DAY });
      const categories = await listCategories(db, "income");
      const salaire = categories.find((c) => c.name === "Salaire")!;

      const inRange = await searchTransactions(db, {
        query: "",
        startDate: NOW - 2 * DAY,
        endDate: NOW - DAY,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: ["income", "expense", "transfer"],
        categoryIds: null,
      });
      expect(inRange.map((t) => t.amount).sort()).toEqual([
        20_000,
        50_000,
        80_000,
      ]);

      const byAmount = await searchTransactions(db, {
        query: "",
        startDate: null,
        endDate: null,
        minAmount: 50_000,
        maxAmount: 80_000,
        accountIds: null,
        types: ["income", "expense", "transfer"],
        categoryIds: null,
      });
      expect(byAmount.map((t) => t.amount).sort()).toEqual([50_000, 80_000]);

      const byAccount = await searchTransactions(db, {
        query: "",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: [b],
        types: ["income", "expense", "transfer"],
        categoryIds: null,
      });
      expect(byAccount).toHaveLength(1);
      expect(byAccount[0].amount).toBe(20_000);

      const byType = await searchTransactions(db, {
        query: "",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: ["income"],
        categoryIds: null,
      });
      expect(byType.map((t) => t.amount).sort()).toEqual([50_000, 80_000]);

      const byCategory = await searchTransactions(db, {
        query: "",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: ["income", "expense", "transfer"],
        categoryIds: [salaire.id],
      });
      expect(byCategory.map((t) => t.amount).sort()).toEqual([50_000, 80_000]);
    });

    it("returns nothing for empty account or category filters", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      await income(db, a, 500);

      const noAccounts = await searchTransactions(db, {
        query: "",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: [],
        types: ["income", "expense", "transfer"],
        categoryIds: null,
      });
      expect(noAccounts).toHaveLength(0);

      const noTypes = await searchTransactions(db, {
        query: "",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: [],
        categoryIds: null,
      });
      expect(noTypes).toHaveLength(0);

      const noCategories = await searchTransactions(db, {
        query: "",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: ["income", "expense", "transfer"],
        categoryIds: [],
      });
      expect(noCategories).toHaveLength(0);
    });

    it("clamps a zero limit to one result", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      await income(db, a, 100);
      await income(db, a, 200);
      const results = await searchTransactions(db, {
        query: "",
        startDate: null,
        endDate: null,
        minAmount: null,
        maxAmount: null,
        accountIds: null,
        types: ["income", "expense", "transfer"],
        categoryIds: null,
      }, 0);
      expect(results).toHaveLength(1);
    });

    it("finds transactions by text across notes and amounts", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      await expense(db, a, 12_345, { note: "Courses du mois" });
      const results = await searchTransactionsByText(db, "cours", 10);
      expect(results).toHaveLength(1);
      expect(results[0].note).toBe("Courses du mois");
      expect((await searchTransactionsByText(db, "1234")).length).toBe(1);
    });
  });

  describe("listTransactions helpers", () => {
    it("lists transactions by month with ascending order", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      const inMonth = NOW;
      const otherMonth = NOW - 40 * DAY;
      await income(db, a, 100, { transactionDate: inMonth });
      await income(db, a, 200, { transactionDate: inMonth + DAY });
      await income(db, a, 300, { transactionDate: otherMonth });

      const rows = await listTransactionsByMonth(db, 2026, 2);
      expect(rows.map((t) => t.amount)).toEqual([100, 200]);
    });

    it("lists distinct years of non-deleted transactions", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      await income(db, a, 100, { transactionDate: Date.UTC(2024, 5, 1) });
      await income(db, a, 200, { transactionDate: Date.UTC(2025, 5, 1) });
      await income(db, a, 300, { transactionDate: Date.UTC(2026, 5, 1) });

      expect(await listTransactionYears(db)).toEqual([2026, 2025, 2024]);
    });
  });

  describe("account flags", () => {
    it("updates hidden and exclude-from-total flags", async () => {
      const a = await createAccount(db, { name: "A", groupId: null });
      await updateAccountFlags(db, a, { hidden: true, excludeFromTotal: true });
      expect((await getAccount(db, a))!.hidden).toBe(true);
      expect((await getAccount(db, a))!.excludeFromTotal).toBe(true);
      await updateAccountFlags(db, a, { hidden: false });
      expect((await getAccount(db, a))!.hidden).toBe(false);
      expect((await getAccount(db, a))!.excludeFromTotal).toBe(true);
    });
  });
});
