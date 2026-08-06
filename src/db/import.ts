import * as SQLite from "expo-sqlite";
import {
  buildImportPlan,
  type ImportPlan,
  type MoneyManagerData,
} from "./money-manager";

export { applyImportPlan, type ImportReport } from "./import-apply";

export interface BackupSummary {
  plan: ImportPlan;
  name: string;
}

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : "Une erreur est survenue.";

async function dumpMoneyManager(
  db: SQLite.SQLiteDatabase,
): Promise<MoneyManagerData> {
  const accounts = await db.getAllAsync<{
    uid: string;
    name: string | null;
    groupUid: string | null;
    zdata: number | null;
  }>("SELECT uid, NIC_NAME AS name, groupUid, ZDATA AS zdata FROM ASSETS");
  const groups = await db.getAllAsync<{ uid: string; name: string | null }>(
    "SELECT uid, ACC_GROUP_NAME AS name FROM ASSETGROUP",
  );
  const categories = await db.getAllAsync<{
    uid: string;
    name: string | null;
    type: number;
  }>("SELECT uid, NAME AS name, TYPE AS type FROM ZCATEGORY");
  const transactions = await db.getAllAsync<{
    doType: number;
    money: number;
    date: number;
    note: string | null;
    categoryUid: string | null;
    accountUid: string | null;
    destinationUid: string | null;
  }>(
    `SELECT DO_TYPE AS doType,
            ZMONEY AS money,
            ZDATE AS date,
            ZCONTENT AS note,
            ctgUid AS categoryUid,
            assetUid AS accountUid,
            toAssetUid AS destinationUid
     FROM INOUTCOME
     WHERE IS_DEL = 0`,
  );
  return { accounts, categories, transactions, groups };
}

export async function readMoneyManagerBackup(
  uri: string,
  displayName: string,
): Promise<BackupSummary> {
  const plainPath = uri.replace(/^file:\/\//, "");
  const lastSlash = plainPath.lastIndexOf("/");
  if (lastSlash <= 0) {
    throw new Error("Chemin de fichier invalide.");
  }
  const directory = plainPath.slice(0, lastSlash);
  const fileName = plainPath.slice(lastSlash + 1);

  let mm: SQLite.SQLiteDatabase;
  try {
    mm = await SQLite.openDatabaseAsync(fileName, undefined, directory);
  } catch (e) {
    throw new Error(`Impossible d'ouvrir le fichier : ${errorMessage(e)}`);
  }

  try {
    const data = await dumpMoneyManager(mm);
    const plan = buildImportPlan(data);
    return { plan, name: displayName };
  } catch (e) {
    throw new Error(
      `Ce fichier n'est pas un backup Money Manager valide (${errorMessage(e)}).`,
    );
  } finally {
    await mm.closeAsync();
  }
}
