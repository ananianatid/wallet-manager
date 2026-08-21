import { WebAppShell } from "@/components/web-app-shell";
import { WebCloudEntities } from "@/components/web-cloud-entities";

export default function WebActivityEntry() {
  return <WebAppShell><WebCloudEntities title="Activité" eyebrow="ESPACE CLOUD" entityTypes={["transactions"]} emptyMessage="Aucune transaction n’est encore enregistrée dans votre espace cloud." /></WebAppShell>;
}
