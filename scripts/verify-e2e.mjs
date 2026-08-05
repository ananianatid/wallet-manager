import { DatabaseSync } from "node:sqlite";
import { buildImportPlan } from "../src/db/money-manager.ts";
import {
  SCHEMA_VERSION_1,
  seedCategories,
} from "../src/db/schema.ts";
import { applyImportPlan } from "../src/db/import-apply.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/verify-e2e.mjs <fichier.mmbak>");
  process.exit(1);
}

const mm = new DatabaseSync(path);

class WalletDbShim {
  constructor(file) {
    this.db = new DatabaseSync(file);
  }
  async execAsync(sql) {
    this.db.exec(sql);
  }
  async runAsync(sql, ...params) {
    const result = this.db.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
  }
  async getFirstAsync(sql, ...params) {
    return this.db.prepare(sql).get(...params) ?? null;
  }
  async getAllAsync(sql, ...params) {
    return this.db.prepare(sql).all(...params);
  }
  async withTransactionAsync(task) {
    this.db.exec("BEGIN");
    try {
      await task();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}

const plan = buildImportPlan({
  accounts: mm.prepare("SELECT uid, NIC_NAME AS name FROM ASSETS").all(),
  categories: mm.prepare("SELECT uid, NAME AS name, TYPE AS type FROM ZCATEGORY").all(),
  transactions: mm.prepare("SELECT DO_TYPE AS doType, ZMONEY AS money, ZDATE AS date, ZCONTENT AS note, ctgUid AS categoryUid, assetUid AS accountUid, toAssetUid AS destinationUid FROM INOUTCOME WHERE IS_DEL = 0").all(),
});

const wallet = new WalletDbShim(":memory:");
await wallet.execAsync(SCHEMA_VERSION_1);
await seedCategories(wallet);

const report1 = await applyImportPlan(wallet, plan);
console.log("=== Premier import ===");
console.log(JSON.stringify(report1, null, 2));

const report2 = await applyImportPlan(wallet, plan);
console.log("=== Re-import (idempotence) ===");
console.log(JSON.stringify(report2, null, 2));

const counts = wallet.db
  .prepare(
    "SELECT (SELECT COUNT(*) FROM accounts) AS accounts, (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM transactions) AS transactions",
  )
  .get();
console.log("=== Base finale ===");
console.log(counts);

const seedsGone = wallet.db
  .prepare("SELECT COUNT(*) AS n FROM categories WHERE name IN ('Nourriture','Transport','Logement','Factures','Santé','Éducation','Loisirs','Shopping','Salaire','Virement reçu','Cadeau','Remboursement','Compte courant','Épargne','Mobile Money')")
  .get();
console.log(`Catégories seed restantes : ${seedsGone.n} (attendu 0)`);

console.log("=== Soldes : wallet vs Money Manager ===");
const walletBalances = wallet.db
  .prepare(
    `SELECT a.name AS name, COALESCE((
       SELECT SUM(CASE
         WHEN t.type = 'income' THEN t.amount
         WHEN t.type = 'expense' THEN -t.amount
         WHEN t.type = 'transfer' THEN CASE
           WHEN t.account_id = a.id THEN -(t.amount + COALESCE(t.fee, 0))
           ELSE t.amount
         END
       END)
       FROM transactions t
       WHERE t.account_id = a.id OR t.destination_account_id = a.id
     ), 0) AS balance
     FROM accounts a ORDER BY a.name`,
  )
  .all();

const mmBalances = mm
  .prepare(
    `SELECT TRIM(a.NIC_NAME) AS name, COALESCE(SUM(CASE
       WHEN t.DO_TYPE = 0 THEN CAST(t.ZMONEY AS REAL)
       WHEN t.DO_TYPE = 1 THEN -CAST(t.ZMONEY AS REAL)
       WHEN t.DO_TYPE = 3 THEN -CAST(t.ZMONEY AS REAL)
       WHEN t.DO_TYPE = 4 THEN CAST(t.ZMONEY AS REAL)
     END), 0) AS balance
     FROM INOUTCOME t JOIN ASSETS a ON a.uid = t.assetUid
     WHERE t.IS_DEL = 0
     GROUP BY TRIM(a.NIC_NAME) ORDER BY TRIM(a.NIC_NAME)`,
  )
  .all();

const byName = new Map(walletBalances.map((r) => [r.name, Number(r.balance)]));
let mismatches = 0;
for (const row of mmBalances) {
  const wallet = byName.get(row.name) ?? 0;
  const mmBalance = Math.round(Number(row.balance));
  const ok = wallet === mmBalance;
  console.log(`${ok ? "OK" : "ÉCHEC"}  ${row.name.padEnd(20)} wallet=${wallet}  mm=${mmBalance}`);
  if (!ok) mismatches++;
}

const expect = (label, actual, wanted) => {
  const ok = actual === wanted;
  console.log(`${ok ? "OK" : "ÉCHEC"}  ${label}: ${actual} (attendu ${wanted})`);
  if (!ok) process.exitCode = 1;
};

console.log("\n=== Vérifications ===");
expect("transactions insérées", report1.transactionsInserted, 1083);
expect("doublons au 2e import", report2.transactionsSkipped, 1083);
expect("réinsérées au 2e import", report2.transactionsInserted, 0);
expect("catégories finales", counts.categories, 18);
expect("comptes finaux", counts.accounts, 17);
expect("transactions finales", counts.transactions, 1083);
expect("écarts de solde", mismatches, 0);

const iconIntegrity = wallet.db
  .prepare(
    `SELECT
       SUM(CASE WHEN type IN ('income', 'expense') AND (icon IS NULL OR icon = '') THEN 1 ELSE 0 END) AS missing,
       SUM(CASE WHEN type = 'account' AND icon IS NOT NULL THEN 1 ELSE 0 END) AS accountIcons
     FROM categories`,
  )
  .get();
expect("catégories métier avec une icône", Number(iconIntegrity.missing), 0);
expect("catégories de comptes sans icône", Number(iconIntegrity.accountIcons), 0);
