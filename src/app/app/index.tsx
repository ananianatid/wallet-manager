import DashboardScreen from "../(tabs)/(dashboard)/index";
import { WebAppShell } from "@/components/web-app-shell";

/** Stable browser entry point for the working local-first application. */
export default function WebAppEntry() {
  return (
    <WebAppShell>
      <DashboardScreen />
    </WebAppShell>
  );
}
