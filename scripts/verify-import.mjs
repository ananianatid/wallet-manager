import { DatabaseSync } from "node:sqlite";
import { buildImportPlan } from "../src/db/money-manager.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/verify-import.mjs <fichier.mmbak>");
  process.exit(1);
}

const db = new DatabaseSync(path);

const accounts = db
  .prepare("SELECT uid, NIC_NAME AS name, groupUid, ZDATA AS zdata FROM ASSETS")
  .all();
const groups = db
  .prepare("SELECT uid, ACC_GROUP_NAME AS name FROM ASSETGROUP")
  .all();
const categories = db
  .prepare("SELECT uid, NAME AS name, TYPE AS type FROM ZCATEGORY")
  .all();
const transactions = db
  .prepare(
    `SELECT DO_TYPE AS doType,
            ZMONEY AS money,
            ZDATE AS date,
            ZCONTENT AS note,
            ctgUid AS categoryUid,
            assetUid AS accountUid,
            toAssetUid AS destinationUid
     FROM INOUTCOME
     WHERE IS_DEL = 0`,
  )
  .all();

console.log(`Fichier : ${path}`);
console.log(`Lignes brutes (INOUTCOME, IS_DEL=0) : ${transactions.length}`);

const plan = buildImportPlan({ accounts, categories, transactions, groups });

console.log("\n=== Plan d'import ===");
console.log(`Comptes          : ${plan.stats.accounts}`);
console.log(`Catégories       : ${plan.stats.categories}`);
console.log(`Revenus          : ${plan.stats.income}`);
console.log(`Dépenses         : ${plan.stats.expense}`);
console.log(`Transferts       : ${plan.stats.transfer}`);
console.log(`Frais fusionnés  : ${plan.stats.feesMerged}`);
console.log(`Frais orphelins  : ${plan.stats.feeOrphans}`);
console.log(
  `Période          : ${new Date(plan.stats.rangeStart ?? 0).toISOString()} → ${new Date(
    plan.stats.rangeEnd ?? 0,
  ).toISOString()}`,
);

console.log("\n=== Comptes ===");
console.log(plan.accounts.map((a) => a.name).join(", "));
console.log("\n=== Catégories ===");
console.log(plan.categories.map((c) => `[${c.type}] ${c.name}`).join("\n"));

const total = plan.stats.income + plan.stats.expense + plan.stats.transfer;
console.log(`\nTotal transactions planifiées : ${total}`);

const accountCategories = plan.categories.filter((c) => c.type === "account");
console.log("\n=== Catégories de comptes ===");
console.log(
  accountCategories.length === 0
    ? "(aucune)"
    : accountCategories.map((c) => c.name).join(", "),
);

const expect = (label, actual, wanted) => {
  const ok = actual === wanted;
  console.log(`${ok ? "OK" : "ÉCHEC"}  ${label}: ${actual} (attendu ${wanted})`);
  if (!ok) process.exitCode = 1;
};

console.log("\n=== Vérifications ===");
expect(
  "catégories de comptes",
  accountCategories.length,
  1,
);
expect("catégorie de comptes", accountCategories[0]?.name ?? "", "Espèces");
expect("comptes", plan.stats.accounts, 18);
expect("revenus", plan.stats.income, 127);
expect("dépenses", plan.stats.expense, 725);
expect("transferts", plan.stats.transfer, 238);
expect("frais fusionnés", plan.stats.feesMerged, 41);
expect("frais orphelins", plan.stats.feeOrphans, 3);
expect("total planifié", total, 1090);
