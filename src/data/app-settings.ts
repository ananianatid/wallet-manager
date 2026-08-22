import { getDatabase } from "@/db/database";
import { getSetting, setSetting, type SettingKey } from "@/db/settings";
import { changeReferenceCurrency } from "@/currency/service";

export function readAppSetting(key: SettingKey): Promise<string | null> {
  return getDatabase().then((db) => getSetting(db, key));
}

export async function writeAppSetting(key: SettingKey, value: string): Promise<void> {
  await setSetting(await getDatabase(), key, value);
}

export async function updateReferenceCurrency(currencyCode: string): Promise<void> {
  await changeReferenceCurrency(await getDatabase(), currencyCode);
}
