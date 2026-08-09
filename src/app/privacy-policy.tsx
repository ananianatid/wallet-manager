import { ShieldCheck } from "lucide-react-native";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme } from "@/theme";

const sections = [
  {
    title: "Les données restent sur votre appareil",
    paragraphs: [
      "Wallet est conçue pour fonctionner localement. Vos comptes, transactions, catégories, budgets, objectifs, règles récurrentes et préférences sont enregistrés dans la base de données de l’application sur votre appareil.",
      "L’application ne crée pas de compte utilisateur et ne propose pas de synchronisation cloud. Elle n’envoie pas vos données financières à un serveur Wallet.",
    ],
  },
  {
    title: "Données enregistrées",
    paragraphs: [
      "Les données que vous saisissez sont utilisées uniquement pour afficher vos soldes, vos statistiques, vos budgets et vos objectifs. Les préférences de devise, de thème et de calendrier sont également conservées localement.",
      "Si vous activez le verrouillage, le réglage du verrouillage ainsi que le sel et l’empreinte dérivée de votre code sont conservés dans le stockage sécurisé du système. Wallet ne peut pas lire ni récupérer vos données biométriques.",
    ],
  },
  {
    title: "Taux de change",
    paragraphs: [
      "Lorsque les conversions de devises sont nécessaires, Wallet peut demander un taux à Frankfurter. Ces requêtes contiennent les codes des devises concernées, par exemple EUR et XOF, et non vos comptes, vos transactions ou vos montants.",
      "Les taux reçus sont mis en cache localement afin de pouvoir être réutilisés hors connexion. Les conversions enregistrées conservent leur taux, leur date et leur fournisseur pour préserver le contexte du calcul.",
    ],
  },
  {
    title: "Sauvegardes et partage",
    paragraphs: [
      "Une sauvegarde n’est créée que lorsque vous la demandez. Elle est chiffrée avec le mot de passe que vous choisissez, puis proposée au partage via le système de votre appareil.",
      "Après le partage, le fichier peut être copié, envoyé ou conservé par les applications et les personnes que vous choisissez. Vérifiez les destinataires et supprimez les copies dont vous n’avez plus besoin.",
    ],
  },
  {
    title: "Conservation et suppression",
    paragraphs: [
      "Les données restent dans l’application jusqu’à leur suppression par vos soins, à la réinitialisation de l’application ou à la désinstallation de Wallet. Une sauvegarde exportée doit être supprimée séparément de l’emplacement où vous l’avez enregistrée.",
    ],
  },
  {
    title: "Services tiers et évolutions",
    paragraphs: [
      "Wallet ne contient pas de publicité ni de profilage. Si la configuration de la version installée contient un DSN Sentry, l’application peut envoyer à Sentry des rapports d’erreurs techniques et des informations de diagnostic nécessaires au dépannage. Cette télémétrie ne doit pas être activée sans mettre à jour cette politique et informer les utilisateurs concernés.",
      "Le système d’exploitation peut appliquer ses propres règles aux fonctions de partage, de stockage sécurisé et d’authentification biométrique.",
      "Cette politique décrit le fonctionnement actuel de l’application. Elle sera mise à jour si les fonctionnalités ou les services utilisés changent.",
    ],
  },
] as const;

export default function PrivacyPolicyScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: "Confidentialité" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <View
          style={[
            styles.summary,
            { backgroundColor: theme.accentSurface },
          ]}
          accessible
          accessibilityRole="summary"
        >
          <View style={[styles.icon, { backgroundColor: theme.accent }]}>
            <ShieldCheck size={22} strokeWidth={2.2} color={theme.onAccent} />
          </View>
          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: theme.accentSurfaceText }]}>Votre vie privée, localement</Text>
            <Text style={[styles.summaryBody, { color: theme.accentSurfaceLabel }]}>Vos données financières restent sur votre appareil, sous votre contrôle.</Text>
          </View>
        </View>

        <View style={styles.introduction}>
          <Text style={[styles.title, { color: theme.label }]}>Politique de confidentialité</Text>
          <Text style={[styles.updated, { color: theme.secondaryLabel }]}>Dernière mise à jour : 9 août 2026</Text>
          <Text style={[styles.body, { color: theme.secondaryLabel }]}>Cette page explique quelles données Wallet utilise, où elles sont conservées et dans quels cas elles quittent votre appareil.</Text>
        </View>

        <View style={styles.sections}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.label }]}>{section.title}</Text>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} style={[styles.body, { color: theme.secondaryLabel }]}>{paragraph}</Text>
              ))}
            </View>
          ))}
        </View>

        <Text style={[styles.footer, { color: theme.secondaryLabel }]}>Pour protéger vos données partagées, utilisez toujours un mot de passe de sauvegarde unique et conservez le fichier dans un emplacement de confiance.</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  summary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  summaryBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  introduction: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  updated: {
    fontSize: 12,
  },
  sections: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    fontSize: 12,
    lineHeight: 18,
    paddingTop: spacing.sm,
  },
});
