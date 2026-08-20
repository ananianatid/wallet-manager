import SettingsScreen from "../(tabs)/(settings)/index";
import { WebAppShell } from "@/components/web-app-shell";

export default function WebSettingsEntry() {
  return <WebAppShell><SettingsScreen /></WebAppShell>;
}
