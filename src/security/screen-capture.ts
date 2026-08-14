import * as SecureStore from "expo-secure-store";

import { isScreenshotsBlocked, setScreenshotsBlocked } from "../../modules/screen-security/src/index";

const KEY_BLOCK_SCREENSHOTS = "security.blockScreenshots";

function parseBlocked(value: string | null): boolean {
  return value !== "0";
}

export async function getBlockScreenshots(): Promise<boolean> {
  return parseBlocked(await SecureStore.getItemAsync(KEY_BLOCK_SCREENSHOTS));
}

export function getBlockScreenshotsSync(): boolean {
  return parseBlocked(SecureStore.getItem(KEY_BLOCK_SCREENSHOTS));
}

export async function setBlockScreenshots(blocked: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY_BLOCK_SCREENSHOTS, blocked ? "1" : "0");
  setScreenshotsBlocked(blocked);
}

export function applyScreenSecurity(): void {
  setScreenshotsBlocked(getBlockScreenshotsSync());
}

export function screenshotsBlockedOnDevice(): boolean {
  return isScreenshotsBlocked();
}
