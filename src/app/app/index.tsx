import { WebAppShell } from "@/components/web-app-shell";
import WebCloudDashboard from "@/components/web-cloud-dashboard";

export default function WebAppEntry() {
  return (
    <WebAppShell>
      <WebCloudDashboard />
    </WebAppShell>
  );
}
