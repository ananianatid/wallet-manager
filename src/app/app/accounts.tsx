import { WebAppShell } from "@/components/web-app-shell";
import { WebCloudEntities } from "@/components/web-cloud-entities";
import { router } from "expo-router";
import { ActionButton } from "@/components/ui";
import { Platform, View } from "react-native";

function openNewAccount() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.assign("/app/accounts/new");
    return;
  }

  router.push("/app/accounts/new" as never);
}

export default function WebAccountsEntry() {
  return <WebAppShell><View><ActionButton label="Ajouter un compte" onPress={openNewAccount} /><WebCloudEntities title="Comptes financiers" eyebrow="ESPACE CLOUD" entityTypes={["accounts"]} emptyMessage="Aucun compte financier n’est encore enregistré dans votre espace cloud." /></View></WebAppShell>;
}
