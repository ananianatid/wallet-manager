import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  CircleDollarSign,
  LockKeyhole,
  PiggyBank,
  ShieldCheck,
  WalletCards,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { radius } from "@/theme";

const DOWNLOAD_PATH = "/app-release.apk";

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

function SectionLabel({ children }: { children: string }) {
  return (
    <View style={styles.sectionLabel}>
      <View style={styles.sectionLabelDot} />
      <Text style={styles.sectionLabelText}>{children}</Text>
    </View>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "income" | "expense" }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === "income" && styles.incomeText, tone === "expense" && styles.expenseText]}>
        {value}
      </Text>
    </View>
  );
}

function DashboardPreview({ narrow }: { narrow: boolean }) {
  return (
    <View style={[styles.previewShell, narrow && styles.previewShellNarrow]}>
      <View style={styles.previewTopBar}>
        <View>
          <Text style={styles.previewKicker}>MARDI 20 AOÛT</Text>
          <Text style={styles.previewGreeting}>Bonjour, Ana</Text>
        </View>
        <View style={styles.previewAvatar}>
          <Text style={styles.previewAvatarText}>A</Text>
        </View>
      </View>

      <View style={styles.availableCard}>
        <View style={styles.availableHeader}>
          <Text style={styles.availableLabel}>DISPONIBLE ESTIMÉ</Text>
          <ArrowUpRight size={17} color="#CFE1D2" strokeWidth={2.3} />
        </View>
        <Text style={styles.availableAmount}>485 000 <Text style={styles.availableCurrency}>XOF</Text></Text>
        <Text style={styles.availableHint}>Après les engagements connus</Text>
        <View style={styles.availableRule} />
        <View style={styles.availableFooter}>
          <Text style={styles.availableFooterLabel}>À dépenser avec confiance</Text>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusPillText}>Serein</Text>
          </View>
        </View>
      </View>

      <View style={styles.previewMetrics}>
        <Metric label="Dépenses ce mois" value="185 000 XOF" tone="expense" />
        <Metric label="Budget restant" value="65 000 XOF" tone="income" />
      </View>

      <View style={styles.previewSectionHeader}>
        <Text style={styles.previewSectionTitle}>Derniers mouvements</Text>
        <Text style={styles.previewSectionAction}>Tout voir</Text>
      </View>
      <View style={styles.transactionCard}>
        <View style={styles.transactionRow}>
          <View style={[styles.transactionIcon, styles.incomeIcon]}>
            <ArrowDownToLine size={15} color="#4C6656" strokeWidth={2.2} />
          </View>
          <View style={styles.transactionCopy}>
            <Text style={styles.transactionTitle}>Salaire</Text>
            <Text style={styles.transactionMeta}>Aujourd’hui · Compte courant</Text>
          </View>
          <Text style={styles.transactionIncome}>+350 000</Text>
        </View>
        <View style={styles.transactionDivider} />
        <View style={styles.transactionRow}>
          <View style={[styles.transactionIcon, styles.expenseIcon]}>
            <ArrowUpRight size={15} color="#B75C52" strokeWidth={2.2} />
          </View>
          <View style={styles.transactionCopy}>
            <Text style={styles.transactionTitle}>Courses</Text>
            <Text style={styles.transactionMeta}>Hier · Compte courant</Text>
          </View>
          <Text style={styles.transactionExpense}>−28 500</Text>
        </View>
      </View>

      <View style={styles.previewTabBar}>
        <View style={[styles.previewTab, styles.previewTabActive]}>
          <BarChart3 size={16} color="#26352D" strokeWidth={2.2} />
          <Text style={styles.previewTabActiveText}>Accueil</Text>
        </View>
        <View style={styles.previewTab}>
          <CalendarDays size={16} color="#85877F" strokeWidth={2.1} />
          <Text style={styles.previewTabText}>Activité</Text>
        </View>
        <View style={styles.previewTab}>
          <PiggyBank size={16} color="#85877F" strokeWidth={2.1} />
          <Text style={styles.previewTabText}>Plans</Text>
        </View>
        <View style={styles.previewTab}>
          <WalletCards size={16} color="#85877F" strokeWidth={2.1} />
          <Text style={styles.previewTabText}>Comptes</Text>
        </View>
      </View>
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
  const { width } = useWindowDimensions();
  const narrow = width < 820;
  const phone = width < 560;
  const [downloadAvailable, setDownloadAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    let active = true;
    fetch(DOWNLOAD_PATH, { method: "HEAD", cache: "no-store" })
      .then((response) => {
        if (active) {
          setDownloadAvailable(response.ok);
        }
      })
      .catch(() => {
        if (active) {
          setDownloadAvailable(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
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
            <Text style={styles.visualCaptionText}>L’écran d’accueil</Text>
            <View style={styles.visualCaptionLine} />
          </View>
          <DashboardPreview narrow={narrow} />
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
  pressed: { opacity: 0.72 },
  hero: { width: "100%", maxWidth: 1180, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 64, paddingBottom: 80 },
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
  heroVisual: { flex: 1, minWidth: 420, maxWidth: 510, position: "relative", paddingTop: 22 },
  heroVisualNarrow: { minWidth: 0, maxWidth: "100%", width: "100%", alignSelf: "center" },
  visualCaption: { position: "absolute", top: 0, right: 30, zIndex: 2, flexDirection: "row", alignItems: "center", gap: 9 },
  visualCaptionText: { color: "#85877F", fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  visualCaptionLine: { width: 38, height: 1, backgroundColor: "#B75C52" },
  previewShell: { width: "100%", maxWidth: 460, alignSelf: "center", padding: 18, borderRadius: 28, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E6E6E0", shadowColor: "#26352D", shadowOpacity: 0.11, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 5 },
  previewShellNarrow: { maxWidth: 510 },
  previewTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  previewKicker: { color: "#85877F", fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },
  previewGreeting: { color: "#181916", fontSize: 21, fontWeight: "800", letterSpacing: -0.8, marginTop: 4 },
  previewAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#DDEADF", alignItems: "center", justifyContent: "center" },
  previewAvatarText: { color: "#4C6656", fontSize: 13, fontWeight: "800" },
  availableCard: { padding: 18, borderRadius: 19, backgroundColor: "#26352D" },
  availableHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  availableLabel: { color: "#CFE1D2", fontSize: 9, fontWeight: "800", letterSpacing: 1.05 },
  availableAmount: { color: "#FFFFFF", fontSize: 32, lineHeight: 37, fontWeight: "800", letterSpacing: -1.3, marginTop: 13 },
  availableCurrency: { color: "#CFE1D2", fontSize: 13, letterSpacing: 0 },
  availableHint: { color: "#AFC8B4", fontSize: 11, marginTop: 3 },
  availableRule: { height: StyleSheet.hairlineWidth, backgroundColor: "#567061", marginVertical: 15 },
  availableFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  availableFooterLabel: { color: "#CFE1D2", fontSize: 10 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: "#3A5143" },
  statusDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: "#B9D9C0" },
  statusPillText: { color: "#DDEADF", fontSize: 9, fontWeight: "700" },
  previewMetrics: { flexDirection: "row", gap: 10, marginTop: 12 },
  metric: { flex: 1, padding: 13, borderRadius: 15, backgroundColor: "#F0F1EC" },
  metricLabel: { color: "#85877F", fontSize: 9, lineHeight: 13 },
  metricValue: { color: "#181916", fontSize: 13, fontWeight: "800", marginTop: 6, letterSpacing: -0.25 },
  incomeText: { color: "#4C6656" },
  expenseText: { color: "#B75C52" },
  previewSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 9 },
  previewSectionTitle: { color: "#181916", fontSize: 13, fontWeight: "800" },
  previewSectionAction: { color: "#4C6656", fontSize: 10, fontWeight: "700" },
  transactionCard: { paddingHorizontal: 12, borderRadius: 15, backgroundColor: "#FAFAF7", borderWidth: 1, borderColor: "#E6E6E0" },
  transactionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, gap: 9 },
  transactionIcon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  incomeIcon: { backgroundColor: "#E4EFE6" },
  expenseIcon: { backgroundColor: "#F6E5E2" },
  transactionCopy: { flex: 1 },
  transactionTitle: { color: "#181916", fontSize: 11, fontWeight: "700" },
  transactionMeta: { color: "#85877F", fontSize: 9, marginTop: 3 },
  transactionIncome: { color: "#4C6656", fontSize: 11, fontWeight: "800" },
  transactionExpense: { color: "#B75C52", fontSize: 11, fontWeight: "800" },
  transactionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E6E6E0" },
  previewTabBar: { flexDirection: "row", justifyContent: "space-around", marginTop: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E6E6E0" },
  previewTab: { alignItems: "center", gap: 4, paddingHorizontal: 8 },
  previewTabActive: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: "#E4EFE6" },
  previewTabText: { color: "#85877F", fontSize: 8 },
  previewTabActiveText: { color: "#26352D", fontSize: 8, fontWeight: "800" },
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
