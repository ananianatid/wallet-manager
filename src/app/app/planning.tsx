import { WebAppShell } from "@/components/web-app-shell";
import { WebCloudEntities } from "@/components/web-cloud-entities";

export default function WebPlanningEntry() {
  return <WebAppShell><WebCloudEntities title="Planification" eyebrow="ESPACE CLOUD" entityTypes={["budget_plans", "goals", "savings_rules", "recurring_transactions"]} emptyMessage="Aucune donnée de planification n’est encore enregistrée dans votre espace cloud." /></WebAppShell>;
}
