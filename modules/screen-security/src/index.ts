import { Platform } from "react-native";
import { requireNativeModule } from "expo";

interface ScreenSecurityModule {
  setScreenshotsBlocked(blocked: boolean): void;
  isScreenshotsBlocked(): boolean;
}

let nativeModule: ScreenSecurityModule | null | undefined;

function getNativeModule(): ScreenSecurityModule | null {
  if (nativeModule === undefined) {
    nativeModule =
      Platform.OS === "android"
        ? requireNativeModule<ScreenSecurityModule>("ScreenSecurity")
        : null;
  }
  return nativeModule;
}

export function setScreenshotsBlocked(blocked: boolean): void {
  getNativeModule()?.setScreenshotsBlocked(blocked);
}

export function isScreenshotsBlocked(): boolean {
  return getNativeModule()?.isScreenshotsBlocked() ?? true;
}
