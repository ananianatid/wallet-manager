import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Check,
  CircleDollarSign,
  FileUp,
  LockKeyhole,
  PiggyBank,
  Tags,
  ShieldCheck,
  WalletCards,
} from "lucide-react-native";
import { Image } from "expo-image";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { radius } from "@/theme";

const DOWNLOAD_PATH = "https://github.com/ananianatid/wallet-manager/releases/latest/download/app-release.apk";

const appScreens = {
  home: require("../../docs/images for the web/optimized/Screenshot_20260820-102453_Wallet Manager.webp"),
  goals: require("../../docs/images for the web/optimized/Screenshot_20260820-102508_Wallet Manager.webp"),
  savings: require("../../docs/images for the web/optimized/Screenshot_20260820-102515_Wallet Manager.webp"),
  activity: require("../../docs/images for the web/optimized/Screenshot_20260820-102521_Wallet Manager.webp"),
  planning: require("../../docs/images for the web/optimized/Screenshot_20260820-102524_Wallet Manager.webp"),
  statistics: require("../../docs/images for the web/optimized/Screenshot_20260820-102529_Wallet Manager.webp"),
  statisticsDetail: require("../../docs/images for the web/optimized/Screenshot_20260820-102543_Wallet Manager.webp"),
  accounts: require("../../docs/images for the web/optimized/Screenshot_20260820-102547_Wallet Manager.webp"),
};

type ScreenshotQueueValue = {
  activeIndex: number;
  markComplete: (index: number) => void;
};

const ScreenshotQueueContext = createContext<ScreenshotQueueValue>({
  activeIndex: 0,
  markComplete: () => undefined,
});

function ScreenshotQueue({ children }: { children: React.ReactNode }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const completedIndexes = useRef(new Set<number>());
  const markComplete = useCallback((index: number) => {
    if (completedIndexes.current.has(index)) {
      return;
    }

    completedIndexes.current.add(index);
    setActiveIndex((currentIndex) => Math.max(currentIndex, index + 1));
  }, []);

  return (
    <ScreenshotQueueContext.Provider value={{ activeIndex, markComplete }}>
      {children}
    </ScreenshotQueueContext.Provider>
  );
}

function AppMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <View style={[styles.appMark, inverse && styles.appMarkInverse]}>
      <WalletCards size={19} color={inverse ? "#26352D" : "#FFFFFF"} strokeWidth={2.2} />
    </View>
  );
}

function DownloadButton({ compact = false }: { compact?: boolean }) {
  return (
    <Pressable
      accessibilityLabel="Télécharger l’application Android"
      accessibilityRole="link"
      onPress={() => void Linking.openURL(DOWNLOAD_PATH)}
      style={({ pressed }) => [
        styles.downloadButton,
        compact && styles.downloadButtonCompact,
        pressed && styles.pressed,
      ]}
    >
      <ArrowDownToLine size={compact ? 16 : 18} color="#FFFFFF" strokeWidth={2.3} />
      <Text style={[styles.downloadButtonText, compact && styles.downloadButtonTextCompact]}>
        Télécharger l’APK
      </Text>
    </Pressable>
  );
}

function OpenWebButton() {
  return (
    <Pressable
      accessibilityLabel="Ouvrir Wallet sur ordinateur"
      accessibilityRole="link"
      onPress={() => void Linking.openURL("/app")}
      style={({ pressed }) => [styles.webAppButton, pressed && styles.pressed]}
    >
      <ArrowUpRight size={18} color="#26352D" strokeWidth={2.3} />
      <Text style={styles.webAppButtonText}>Ouvrir Wallet sur PC</Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <View style={styles.sectionLabel}>
      <View style={styles.sectionLabelDot} />
      <Text style={styles.sectionLabelText}>{children}</Text>
    </View>
  );
}

function ScreenshotFrame({
  source,
  label,
  sequence,
  prominent = false,
}: {
  source: number;
  label: string;
  sequence: number;
  prominent?: boolean;
}) {
  const { activeIndex, markComplete } = useContext(ScreenshotQueueContext);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const canLoad = sequence <= activeIndex;

  const complete = (nextStatus: "ready" | "error") => {
    setStatus(nextStatus);
    markComplete(sequence);
  };

  return (
    <View style={[styles.screenshotFrame, prominent && styles.screenshotFrameProminent]}>
      {canLoad ? (
        <Image
          source={source}
          alt={label}
          accessibilityLabel={label}
          contentFit="contain"
          cachePolicy="disk"
          loading="eager"
          onLoadStart={() => setStatus("loading")}
          onLoad={() => complete("ready")}
          onError={() => complete("error")}
          style={styles.screenshotImage}
        />
      ) : null}
      {status !== "ready" ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole={status === "error" ? "alert" : "progressbar"}
          style={styles.screenshotLoader}
        >
          {status === "error" ? (
            <Text style={styles.screenshotLoaderText}>Aperçu indisponible</Text>
          ) : (
            <>
              {status === "loading" ? <ActivityIndicator color="#4C6656" size="small" /> : null}
              <Text style={styles.screenshotLoaderText}>
                {status === "loading" ? "Chargement de l’aperçu…" : "Préparation de l’aperçu…"}
              </Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function ScreenshotFeature({
  eyebrow,
  title,
  children,
  source,
  label,
  sequence,
  narrow = false,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  children: string;
  source: number;
  label: string;
  sequence: number;
  narrow?: boolean;
  reverse?: boolean;
}) {
  return (
    <View style={[styles.screenshotFeature, reverse && styles.screenshotFeatureReverse, narrow && styles.screenshotFeatureNarrow]}>
      <View style={styles.screenshotFeatureCopy}>
        <SectionLabel>{eyebrow}</SectionLabel>
        <Text style={styles.screenshotFeatureTitle}>{title}</Text>
        <Text style={styles.screenshotFeatureBody}>{children}</Text>
      </View>
      <ScreenshotFrame source={source} label={label} sequence={sequence} />
    </View>
  );
}

function ScreenshotCard({
  title,
  children,
  source,
  label,
  sequence,
}: {
  title: string;
  children: string;
  source: number;
  label: string;
  sequence: number;
}) {
  return (
    <View style={styles.screenshotCard}>
      <ScreenshotFrame source={source} label={label} sequence={sequence} />
      <Text style={styles.screenshotCardTitle}>{title}</Text>
      <Text style={styles.screenshotCardBody}>{children}</Text>
    </View>
  );
}

function FeatureCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>{icon}</View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{children}</Text>
    </View>
  );
}

function CapabilityCard({
  icon,
  title,
  children,
  narrow = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: string;
  narrow?: boolean;
}) {
  return (
    <View style={[styles.capabilityCard, narrow && styles.capabilityCardNarrow]}>
      <View style={styles.capabilityIcon}>{icon}</View>
      <View style={styles.capabilityCopy}>
        <Text style={styles.capabilityTitle}>{title}</Text>
        <Text style={styles.capabilityBody}>{children}</Text>
      </View>
    </View>
  );
}

function Step({ number, title, children }: { number: string; title: string; children: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{number}</Text>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{children}</Text>
      </View>
    </View>
  );
}

export default function LandingPage() {
  const { width: nativeWidth } = useWindowDimensions();
  const [webWidth, setWebWidth] = useState<number | null>(() => (
    Platform.OS === "web" && typeof window !== "undefined" ? window.innerWidth : null
  ));
  const downloadAvailable = Platform.OS === "web";

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const updateWidth = () => setWebWidth(window.innerWidth);
    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const width = webWidth ?? nativeWidth;
  const narrow = width < 820;
  const phone = width < 560;

  return (
    <ScreenshotQueue>
      <ScrollView
        key={narrow ? "landing-narrow" : "landing-wide"}
        style={styles.page}
        contentContainerStyle={styles.pageContent}
      >
      <View style={styles.header}>
        <View style={styles.brand}>
          <AppMark />
          <Text style={styles.brandName}>Wallet Manager</Text>
        </View>
        {!phone && downloadAvailable ? (
          <View style={styles.headerActions}>
            <Text style={styles.headerNote}>Finance personnelle, sans bruit.</Text>
            <DownloadButton compact />
          </View>
        ) : null}
      </View>

      <View style={[styles.hero, narrow && styles.heroNarrow]}>
        <View style={[styles.heroCopy, narrow && styles.heroCopyNarrow]}>
          <SectionLabel>VOTRE ARGENT, ENFIN LISIBLE</SectionLabel>
          <Text style={styles.heroTitle}>Décidez avec votre argent, pas contre lui.</Text>
          <Text style={styles.heroBody}>
            Wallet Manager rassemble vos comptes, vos dépenses et vos projets dans une seule vue calme. Vos données restent sur votre appareil, pour garder la main même sans connexion.
          </Text>
          <View style={styles.heroActions}>
            <OpenWebButton />
            {downloadAvailable ? <DownloadButton /> : null}
            {downloadAvailable ? <Text style={styles.heroActionNote}>Android · APK gratuit · XOF par défaut</Text> : null}
          </View>
          <View style={styles.heroSignals}>
            <View style={styles.signal}>
              <ShieldCheck size={16} color="#4C6656" strokeWidth={2.1} />
              <Text style={styles.signalText}>Local-first</Text>
            </View>
            <View style={styles.signal}>
              <LockKeyhole size={16} color="#4C6656" strokeWidth={2.1} />
              <Text style={styles.signalText}>Privé par défaut</Text>
            </View>
          </View>
        </View>
        <View style={[styles.heroVisual, narrow && styles.heroVisualNarrow]}>
          <View style={styles.visualCaption}>
            <Text style={styles.visualCaptionText}>L’écran réel de Wallet</Text>
            <View style={styles.visualCaptionLine} />
          </View>
          <ScreenshotFrame
            source={appScreens.home}
            label="Capture de l’écran d’accueil de Wallet : patrimoine disponible, budgets et activité récente"
            sequence={0}
            prominent
          />
        </View>
      </View>

      <View style={styles.trustBand}>
        <Text style={styles.trustLead}>Une vue pour</Text>
        <View style={styles.trustItem}><CircleDollarSign size={17} color="#4C6656" /><Text style={styles.trustText}>comprendre le mois</Text></View>
        <View style={styles.trustItem}><PiggyBank size={17} color="#4C6656" /><Text style={styles.trustText}>préparer vos projets</Text></View>
        <View style={styles.trustItem}><ShieldCheck size={17} color="#4C6656" /><Text style={styles.trustText}>rester maître de vos données</Text></View>
      </View>

      <View nativeID="features" style={styles.section}>
        <SectionLabel>CE QUI RESTE VISIBLE</SectionLabel>
        <View style={[styles.sectionHeadingRow, narrow && styles.sectionHeadingRowNarrow]}>
          <Text style={styles.sectionTitle}>Tout ce qui compte, sans tableau de bord bruyant.</Text>
          <Text style={styles.sectionIntro}>L’app traduit les chiffres en décisions simples : ce qui est disponible, ce qui arrive, et ce que vous pouvez préparer.</Text>
        </View>
        <View style={[styles.featureGrid, narrow && styles.featureGridNarrow]}>
          <FeatureCard icon={<CircleDollarSign size={22} color="#26352D" strokeWidth={2.1} />} title="Voir clair">
            Un montant disponible estimé qui tient compte de vos mouvements et de vos engagements connus.
          </FeatureCard>
          <FeatureCard icon={<BarChart3 size={22} color="#26352D" strokeWidth={2.1} />} title="Lire le mois">
            Revenus, dépenses, budgets et tendances se retrouvent au même endroit, avec des repères utiles.
          </FeatureCard>
          <FeatureCard icon={<PiggyBank size={22} color="#26352D" strokeWidth={2.1} />} title="Préparer la suite">
            Objectifs, épargne et échéances vous aident à réserver de l’argent pour ce qui compte vraiment.
          </FeatureCard>
        </View>
      </View>

      <View style={styles.capabilitySection}>
        <SectionLabel>AU-DELÀ DES CAPTURES</SectionLabel>
        <View style={[styles.sectionHeadingRow, narrow && styles.sectionHeadingRowNarrow]}>
          <Text style={styles.sectionTitle}>Une app complète, même quand l’écran ne raconte pas tout.</Text>
          <Text style={styles.sectionIntro}>Wallet protège aussi les décisions qui se passent dans les coulisses : importer, prévoir, retrouver et récupérer ses données sans perdre le contrôle.</Text>
        </View>
        <View style={[styles.capabilityGrid, narrow && styles.capabilityGridNarrow]}>
          <CapabilityCard narrow={narrow} icon={<CircleDollarSign size={21} color="#26352D" strokeWidth={2.1} />} title="Un journal vraiment précis">
            Fractionnez une dépense, rattachez-la à une personne et suivez les règlements sans créer d’écriture cachée.
          </CapabilityCard>
          <CapabilityCard narrow={narrow} icon={<Tags size={21} color="#26352D" strokeWidth={2.1} />} title="Marchands, tags et reçus">
            Retrouvez une opération par marchand ou tag, puis gardez ses justificatifs image ou PDF dans le stockage local.
          </CapabilityCard>
          <CapabilityCard narrow={narrow} icon={<FileUp size={21} color="#26352D" strokeWidth={2.1} />} title="Importer sans surprise">
            Prévisualisez un CSV, corrigez les lignes invalides, repérez les doublons et validez uniquement ce qui doit entrer.
          </CapabilityCard>
          <CapabilityCard narrow={narrow} icon={<PiggyBank size={21} color="#26352D" strokeWidth={2.1} />} title="Préparer les mois à venir">
            Budgets avec report, objectifs et règles d’épargne rendent les engagements futurs visibles sans confondre prévision et solde réel.
          </CapabilityCard>
          <CapabilityCard narrow={narrow} icon={<BarChart3 size={21} color="#26352D" strokeWidth={2.1} />} title="Automatiser avec validation">
            Les échéances récurrentes deviennent des propositions à approuver, ignorer ou reprogrammer : aucune transaction silencieuse.
          </CapabilityCard>
          <CapabilityCard narrow={narrow} icon={<ShieldCheck size={21} color="#26352D" strokeWidth={2.1} />} title="Rester privé et récupérable">
            PIN, biométrie, sauvegarde chiffrée, restauration et données locales : votre suivi reste disponible même hors connexion.
          </CapabilityCard>
        </View>
      </View>

      <View style={[styles.storySection, narrow && styles.storySectionNarrow]}>
        <View style={styles.storyPanel}>
          <SectionLabel>UNE ROUTINE PLUS SIMPLE</SectionLabel>
          <Text style={styles.storyTitle}>Comprendre. Agir. Reprendre.</Text>
          <Text style={styles.storyBody}>L’interface suit le rythme réel de votre argent. Elle ne vous demande pas d’aimer les feuilles de calcul : elle vous montre le prochain choix utile.</Text>
          <View style={styles.checkList}>
            <View style={styles.checkRow}><Check size={16} color="#4C6656" strokeWidth={2.4} /><Text style={styles.checkText}>Saisir une dépense en quelques secondes</Text></View>
            <View style={styles.checkRow}><Check size={16} color="#4C6656" strokeWidth={2.4} /><Text style={styles.checkText}>Retrouver un mouvement sans fouiller</Text></View>
            <View style={styles.checkRow}><Check size={16} color="#4C6656" strokeWidth={2.4} /><Text style={styles.checkText}>Garder une copie de vos données</Text></View>
          </View>
        </View>
        <View style={styles.stepsPanel}>
          <Step number="01" title="Enregistrer">Ajoutez les comptes et les mouvements qui font votre quotidien.</Step>
          <Step number="02" title="Observer">L’écran d’accueil met en évidence le disponible et les changements du mois.</Step>
          <Step number="03" title="Décider">Budgétez, épargnez ou réservez une somme avec une information compréhensible.</Step>
        </View>
      </View>

      <View style={styles.screenshotSection}>
        <SectionLabel>VOIR CE QUI SE PASSE</SectionLabel>
        <View style={[styles.sectionHeadingRow, narrow && styles.sectionHeadingRowNarrow]}>
          <Text style={styles.sectionTitle}>Une lecture simple, du compte à la décision.</Text>
          <Text style={styles.sectionIntro}>Les écrans importants restent reliés : vos mouvements expliquent votre patrimoine, et votre patrimoine donne du contexte à chaque choix.</Text>
        </View>
        <View style={styles.screenshotFeatureStack}>
          <ScreenshotFeature
            eyebrow="ACTIVITÉ"
            title="Retrouvez chaque mouvement sans fouiller."
            source={appScreens.activity}
            label="Capture de l’écran Activité avec les revenus, dépenses et échéances du mois"
            sequence={1}
            narrow={narrow}
          >
            Les opérations sont regroupées par date, avec le compte, la catégorie et le montant visibles au même endroit.
          </ScreenshotFeature>
          <ScreenshotFeature
            eyebrow="COMPTES"
            title="Sachez où se trouve votre argent."
            source={appScreens.accounts}
            label="Capture de l’écran Comptes avec le patrimoine, le disponible et les comptes par groupe"
            sequence={2}
            narrow={narrow}
            reverse
          >
            Espèces, banque et épargne restent distincts, tandis que le patrimoine total et le disponible gardent leur propre sens.
          </ScreenshotFeature>
        </View>
      </View>

      <View style={[styles.planningSection, narrow && styles.planningSectionNarrow]}>
        <View style={styles.planningIntro}>
          <SectionLabel>PRÉPARER LA SUITE</SectionLabel>
          <Text style={styles.storyTitle}>Donnez une destination à votre argent.</Text>
          <Text style={styles.storyBody}>Objectifs, réserves et règles d’épargne rendent les dépenses futures visibles sans cacher ce qui reste vraiment disponible.</Text>
        </View>
        <View style={[styles.screenshotCardGrid, narrow && styles.screenshotCardGridNarrow]}>
          <ScreenshotCard
            title="Objectifs"
            source={appScreens.goals}
            label="Capture de l’écran Objectifs avec les cibles actives et leur progression"
            sequence={3}
          >
            Suivez ce qui est déjà réservé et ce qu’il reste à construire.
          </ScreenshotCard>
          <ScreenshotCard
            title="Planification"
            source={appScreens.planning}
            label="Capture de l’écran Planification avec les budgets et objectifs actifs"
            sequence={4}
          >
            Transformez le mois en décisions concrètes, par catégorie et par projet.
          </ScreenshotCard>
          <ScreenshotCard
            title="Épargne"
            source={appScreens.savings}
            label="Capture de l’écran Suivi de l’épargne avec les montants estimés et retirés du disponible"
            sequence={5}
          >
            Rendez l’épargne automatique lisible, sans réduire artificiellement le disponible estimé.
          </ScreenshotCard>
        </View>
      </View>

      <View style={styles.screenshotSection}>
        <SectionLabel>LIRE LE MOIS</SectionLabel>
        <View style={[styles.sectionHeadingRow, narrow && styles.sectionHeadingRowNarrow]}>
          <Text style={styles.sectionTitle}>Des statistiques qui éclairent une action.</Text>
          <Text style={styles.sectionIntro}>Passez de la vue d’ensemble aux détails utiles pour comprendre une évolution, sans transformer votre argent en tableau de chiffres.</Text>
        </View>
        <View style={[styles.statisticsShowcase, narrow && styles.statisticsShowcaseNarrow]}>
          <ScreenshotFrame
            source={appScreens.statistics}
            label="Capture de l’écran Statistiques avec la répartition des dépenses par catégorie"
            sequence={6}
          />
          <ScreenshotFrame
            source={appScreens.statisticsDetail}
            label="Capture du détail des statistiques avec la comparaison aux périodes précédentes"
            sequence={7}
          />
        </View>
      </View>

      {downloadAvailable ? (
        <View nativeID="download" style={[styles.downloadPanel, narrow && styles.downloadPanelNarrow]}>
          <View style={styles.downloadPanelCopy}>
            <SectionLabel>COMMENCER MAINTENANT</SectionLabel>
            <Text style={styles.downloadTitle}>Votre argent mérite un écran plus calme.</Text>
            <Text style={styles.downloadBody}>Téléchargez la version Android et gardez votre suivi financier avec vous, même lorsque le réseau disparaît.</Text>
          </View>
          <View style={[styles.downloadPanelAction, narrow && styles.downloadPanelActionNarrow]}>
            <DownloadButton />
            <Text style={styles.downloadFinePrint}>APK Android disponible au téléchargement.</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.brand}>
          <AppMark inverse />
          <Text style={styles.footerBrandName}>Wallet Manager</Text>
        </View>
        <Text style={styles.footerNote}>Une finance personnelle lisible, locale et maîtrisée.</Text>
        <Text style={styles.footerVersion}>Version 1.0 · Android</Text>
      </View>
      </ScrollView>
    </ScreenshotQueue>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F5F2" },
  pageContent: { paddingHorizontal: "6%", paddingTop: 24, paddingBottom: 40 },
  header: { width: "100%", maxWidth: 1180, alignSelf: "center", minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 48 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  appMark: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#26352D" },
  appMarkInverse: { backgroundColor: "#DDEADF" },
  brandName: { color: "#181916", fontSize: 15, fontWeight: "700", letterSpacing: -0.25 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 24 },
  headerNote: { color: "#6B7068", fontSize: 13 },
  downloadButton: { minHeight: 50, paddingHorizontal: 20, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: "#26352D", shadowColor: "#26352D", shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  downloadButtonCompact: { minHeight: 42, paddingHorizontal: 16 },
  downloadButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: -0.15 },
  downloadButtonTextCompact: { fontSize: 13 },
  webAppButton: { minHeight: 50, paddingHorizontal: 20, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: "#E4EFE6", borderWidth: 1, borderColor: "#D4E0D5" },
  webAppButtonText: { color: "#26352D", fontSize: 14, fontWeight: "800", letterSpacing: -0.15 },
  pressed: { opacity: 0.72 },
  hero: { width: "100%", maxWidth: 1180, alignSelf: "center", flexDirection: "row", alignItems: "flex-start", gap: 64, paddingBottom: 80 },
  heroNarrow: { flexDirection: "column", alignItems: "stretch", gap: 44 },
  heroCopy: { flex: 1, maxWidth: 575 },
  heroCopyNarrow: { maxWidth: "100%" },
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 },
  sectionLabelDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: "#B75C52" },
  sectionLabelText: { color: "#4C6656", fontSize: 11, fontWeight: "800", letterSpacing: 1.15 },
  heroTitle: { color: "#181916", fontSize: 64, lineHeight: 66, fontWeight: "800", letterSpacing: -3.2, maxWidth: 570 },
  heroBody: { color: "#6B7068", fontSize: 17, lineHeight: 27, marginTop: 24, maxWidth: 500 },
  heroActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 16, marginTop: 32 },
  heroActionNote: { color: "#85877F", fontSize: 12 },
  heroSignals: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 28 },
  signal: { flexDirection: "row", alignItems: "center", gap: 7 },
  signalText: { color: "#4C6656", fontSize: 12, fontWeight: "600" },
  heroVisual: { width: "44%", maxWidth: 510, position: "relative", paddingTop: 22 },
  heroVisualNarrow: { maxWidth: "100%", width: "100%", alignSelf: "center" },
  visualCaption: { position: "absolute", top: 0, right: 30, zIndex: 2, flexDirection: "row", alignItems: "center", gap: 9 },
  visualCaptionText: { color: "#85877F", fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  visualCaptionLine: { width: 38, height: 1, backgroundColor: "#B75C52" },
  screenshotFrame: { width: 224, aspectRatio: 720 / 1438, alignSelf: "center", overflow: "hidden", position: "relative", borderRadius: 28, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E6E0", shadowColor: "#26352D", shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 4 },
  screenshotFrameProminent: { width: 340, maxWidth: "100%", borderRadius: 32, shadowOpacity: 0.16, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 5 },
  screenshotImage: { width: "100%", height: "100%" },
  screenshotLoader: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 10, padding: 20, backgroundColor: "#E4EFE6" },
  screenshotLoaderText: { color: "#4C6656", fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center" },
  trustBand: { width: "100%", maxWidth: 1180, alignSelf: "center", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 24, paddingVertical: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#D9DCD4" },
  trustLead: { color: "#85877F", fontSize: 12, fontWeight: "700" },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  trustText: { color: "#4C6656", fontSize: 12, fontWeight: "600" },
  section: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingTop: 104, paddingBottom: 104 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "flex-end", gap: 44, marginBottom: 32 },
  sectionHeadingRowNarrow: { flexDirection: "column", alignItems: "stretch", gap: 16 },
  sectionTitle: { flex: 1.05, color: "#181916", fontSize: 38, lineHeight: 43, fontWeight: "800", letterSpacing: -1.7 },
  sectionIntro: { flex: 0.85, color: "#6B7068", fontSize: 15, lineHeight: 23, paddingBottom: 3 },
  featureGrid: { flexDirection: "row", gap: 14 },
  featureGridNarrow: { flexDirection: "column" },
  featureCard: { flex: 1, minHeight: 220, padding: 22, borderRadius: radius.lg, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E6E0" },
  featureIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#E4EFE6", marginBottom: 36 },
  featureTitle: { color: "#181916", fontSize: 20, fontWeight: "800", letterSpacing: -0.6 },
  featureBody: { color: "#6B7068", fontSize: 14, lineHeight: 22, marginTop: 9 },
  capabilitySection: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingTop: 0, paddingBottom: 104 },
  capabilityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  capabilityGridNarrow: { flexDirection: "column" },
  capabilityCard: { width: "48.8%", minHeight: 146, flexDirection: "row", gap: 18, padding: 22, borderRadius: radius.lg, backgroundColor: "#E4EFE6", borderWidth: 1, borderColor: "#D4E0D5" },
  capabilityCardNarrow: { width: "100%" },
  capabilityIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  capabilityCopy: { flex: 1 },
  capabilityTitle: { color: "#26352D", fontSize: 17, fontWeight: "800", letterSpacing: -0.45 },
  capabilityBody: { color: "#4C6656", fontSize: 13, lineHeight: 20, marginTop: 7 },
  screenshotSection: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingTop: 104, paddingBottom: 104 },
  screenshotFeatureStack: { gap: 56 },
  screenshotFeature: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 64, padding: 40, borderRadius: 28, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E6E0" },
  screenshotFeatureReverse: { flexDirection: "row-reverse" },
  screenshotFeatureNarrow: { flexDirection: "column", alignItems: "stretch", gap: 32, padding: 28 },
  screenshotFeatureCopy: { flex: 1, maxWidth: 440 },
  screenshotFeatureTitle: { color: "#181916", fontSize: 34, lineHeight: 39, fontWeight: "800", letterSpacing: -1.4 },
  screenshotFeatureBody: { color: "#6B7068", fontSize: 15, lineHeight: 24, marginTop: 16 },
  planningSection: { width: "100%", maxWidth: 1180, alignSelf: "center", padding: 56, borderRadius: 28, backgroundColor: "#E4EFE6" },
  planningSectionNarrow: { padding: 28 },
  planningIntro: { maxWidth: 610, marginBottom: 36 },
  screenshotCardGrid: { flexDirection: "row", gap: 16 },
  screenshotCardGridNarrow: { flexDirection: "column" },
  screenshotCard: { flex: 1, alignItems: "center", padding: 22, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D4E0D5" },
  screenshotCardTitle: { alignSelf: "stretch", color: "#26352D", fontSize: 20, fontWeight: "800", letterSpacing: -0.5, marginTop: 22 },
  screenshotCardBody: { alignSelf: "stretch", color: "#4C6656", fontSize: 13, lineHeight: 20, marginTop: 8 },
  statisticsShowcase: { flexDirection: "row", justifyContent: "center", gap: 48 },
  statisticsShowcaseNarrow: { flexDirection: "column", gap: 32 },
  storySection: { width: "100%", maxWidth: 1180, alignSelf: "center", flexDirection: "row", gap: 56, paddingVertical: 76, paddingHorizontal: 56, borderRadius: 28, backgroundColor: "#E4EFE6" },
  storySectionNarrow: { flexDirection: "column", paddingHorizontal: 28 },
  storyPanel: { flex: 1 },
  storyTitle: { color: "#26352D", fontSize: 42, lineHeight: 46, fontWeight: "800", letterSpacing: -1.8, maxWidth: 420 },
  storyBody: { color: "#4C6656", fontSize: 15, lineHeight: 24, maxWidth: 430, marginTop: 18 },
  checkList: { gap: 12, marginTop: 28 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  checkText: { color: "#26352D", fontSize: 13, fontWeight: "600" },
  stepsPanel: { flex: 1, justifyContent: "center", gap: 24 },
  step: { flexDirection: "row", gap: 18, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#BBD1BF" },
  stepNumber: { color: "#B75C52", fontSize: 12, fontWeight: "800", letterSpacing: 0.8, paddingTop: 3 },
  stepCopy: { flex: 1 },
  stepTitle: { color: "#26352D", fontSize: 17, fontWeight: "800" },
  stepBody: { color: "#4C6656", fontSize: 13, lineHeight: 20, marginTop: 5 },
  downloadPanel: { width: "100%", maxWidth: 1180, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 28, paddingVertical: 64, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#D9DCD4" },
  downloadPanelNarrow: { flexDirection: "column", alignItems: "stretch" },
  downloadPanelCopy: { flex: 1 },
  downloadTitle: { color: "#181916", fontSize: 34, lineHeight: 39, fontWeight: "800", letterSpacing: -1.4, maxWidth: 560 },
  downloadBody: { color: "#6B7068", fontSize: 14, lineHeight: 22, maxWidth: 520, marginTop: 12 },
  downloadPanelAction: { minWidth: 230, alignItems: "flex-start" },
  downloadPanelActionNarrow: { minWidth: 0 },
  downloadFinePrint: { color: "#85877F", fontSize: 11, lineHeight: 16, marginTop: 10, maxWidth: 215 },
  footer: { width: "100%", maxWidth: 1180, alignSelf: "center", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 18, paddingTop: 28 },
  footerBrandName: { color: "#26352D", fontSize: 14, fontWeight: "800" },
  footerNote: { flex: 1, color: "#85877F", fontSize: 12 },
  footerVersion: { color: "#85877F", fontSize: 11 },
});
