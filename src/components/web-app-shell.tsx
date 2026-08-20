import { router, usePathname } from "expo-router";
import {
  BarChart3,
  LayoutDashboard,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings2,
  WalletCards,
  type LucideIcon,
} from "lucide-react-native";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSyncExternalStore, type ReactNode } from "react";
import { useTheme } from "@/theme";

export const DESKTOP_BREAKPOINT = 1080;

const WEB_NAV_ITEMS: { label: string; href: string; icon: LucideIcon; match: string[] }[] = [
  { label: "Accueil", href: "/app", icon: LayoutDashboard, match: ["/", "/app"] },
  { label: "Activité", href: "/app/activity", icon: ReceiptText, match: ["/app/activity", "/search"] },
  { label: "Planification", href: "/app/planning", icon: PiggyBank, match: ["/app/planning", "/plans", "/budgets", "/goals", "/savings", "/recurring"] },
  { label: "Statistiques", href: "/app/statistics", icon: BarChart3, match: ["/app/statistics", "/statistics"] },
  { label: "Comptes", href: "/app/accounts", icon: WalletCards, match: ["/app/accounts", "/accounts", "/account-groups"] },
];

function isActive(pathname: string, matches: string[]) {
  return matches.some((match) => {
    if (match === "/") {
      return pathname === "/" || pathname === "/app" || pathname === "/app/";
    }
    if (match === "/app") {
      return pathname === "/app" || pathname === "/app/";
    }
    return pathname.startsWith(match);
  });
}

function navigate(href: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.assign(href);
    return;
  }
  router.push(href as never);
}

export function WebSidebar({ pathname }: { pathname: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.sidebar, { backgroundColor: theme.accent }]}>
      <View style={styles.sidebarBrand}>
        <View style={styles.sidebarMark}><WalletCards size={19} color={theme.accent} strokeWidth={2.2} /></View>
        <View>
          <Text style={styles.sidebarBrandName}>Wallet</Text>
          <Text style={styles.sidebarBrandMeta}>Finance personnelle</Text>
        </View>
      </View>

      <Pressable
        onPress={() => navigate("/new-transaction")}
        accessibilityRole="button"
        accessibilityLabel="Nouvelle opération"
        style={({ pressed }) => [styles.quickAdd, pressed && styles.pressed]}
      >
        <Plus size={19} color={theme.accent} strokeWidth={2.4} />
        <Text style={styles.quickAddText}>Nouvelle opération</Text>
      </Pressable>

      <Text style={styles.sidebarSectionLabel}>ESPACE DE TRAVAIL</Text>
      <View style={styles.sidebarNav}>
        {WEB_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.match);
          return (
            <Pressable
              key={item.label}
              onPress={() => navigate(item.href)}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.sidebarItem, active && styles.sidebarItemActive, pressed && styles.pressed]}
            >
              <Icon size={18} color={active ? theme.accent : "#B7C8BA"} strokeWidth={active ? 2.4 : 2} />
              <Text style={[styles.sidebarItemText, active && styles.sidebarItemTextActive]}>{item.label}</Text>
              {active ? <View style={styles.sidebarActiveDot} /> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sidebarBottom}>
        <Pressable
          onPress={() => navigate("/app/settings")}
          accessibilityRole="link"
          accessibilityLabel="Réglages"
          style={({ pressed }) => [styles.sidebarItem, pathname.startsWith("/app/settings") && styles.sidebarItemActive, pressed && styles.pressed]}
        >
          <Settings2 size={18} color="#B7C8BA" strokeWidth={2} />
          <Text style={styles.sidebarItemText}>Réglages</Text>
        </Pressable>
        <View style={styles.sidebarNote}>
          <Text style={styles.sidebarNoteTitle}>Vos données restent locales.</Text>
          <Text style={styles.sidebarNoteBody}>Ce navigateur garde sa propre base Wallet.</Text>
        </View>
      </View>
    </View>
  );
}

export function WebTopBar() {
  const theme = useTheme();
  const pathname = usePathname();
  const item = WEB_NAV_ITEMS.find((entry) => isActive(pathname, entry.match));
  return (
    <View style={[styles.webTopBar, { borderBottomColor: theme.separator }]}>
      <View>
        <Text style={[styles.webTopBarEyebrow, { color: theme.secondaryLabel }]}>WALLET · ESPACE WEB</Text>
        <Text style={[styles.webTopBarTitle, { color: theme.label }]}>{item?.label ?? "Wallet"}</Text>
      </View>
      <View style={styles.webTopBarActions}>
        <Text style={[styles.webTopBarHint, { color: theme.secondaryLabel }]}>Local · hors ligne · maîtrisé</Text>
        <Pressable
          onPress={() => navigate("/new-transaction")}
          accessibilityRole="button"
          accessibilityLabel="Ajouter une opération"
          style={({ pressed }) => [styles.topBarAction, { backgroundColor: theme.accent }, pressed && styles.pressed]}
        >
          <Plus size={17} color={theme.onAccent} strokeWidth={2.4} />
          <Text style={[styles.topBarActionText, { color: theme.onAccent }]}>Ajouter</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WebMobileNav({ pathname }: { pathname: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.mobileNav, { backgroundColor: theme.surface, borderTopColor: theme.separator }]}>
      {WEB_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.match);
        return (
          <Pressable
            key={item.label}
            onPress={() => navigate(item.href)}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.mobileNavItem, pressed && styles.pressed]}
          >
            <Icon size={19} color={active ? theme.accent : theme.secondaryLabel} strokeWidth={active ? 2.4 : 2} />
            <Text style={[styles.mobileNavLabel, { color: active ? theme.accent : theme.secondaryLabel }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WebAppShell({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const desktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;

  if (!mounted) {
    return <View style={[styles.webBootPlaceholder, { backgroundColor: theme.background }]} />;
  }

  if (!desktop) {
    return (
      <View style={[styles.mobileShell, { backgroundColor: theme.background }]}>
        <View style={styles.mobileContent}>{children}</View>
        <WebMobileNav pathname={pathname} />
      </View>
    );
  }

  return (
    <View style={[styles.webShell, { backgroundColor: theme.background }]}>
      <WebSidebar pathname={pathname} />
      <View style={styles.webMain}>
        <WebTopBar />
        <View style={styles.webNavigator}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webShell: { flex: 1, flexDirection: "row", minHeight: "100%" },
  sidebar: { width: 248, minHeight: "100%", paddingHorizontal: 18, paddingTop: 28, paddingBottom: 22 },
  sidebarBrand: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 8, marginBottom: 34 },
  sidebarMark: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#DDEADF" },
  sidebarBrandName: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
  sidebarBrandMeta: { color: "#B7C8BA", fontSize: 11, marginTop: 2 },
  quickAdd: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 34, borderRadius: 13, backgroundColor: "#DDEADF" },
  quickAddText: { color: "#26352D", fontSize: 13, fontWeight: "800" },
  sidebarSectionLabel: { color: "#8FA796", fontSize: 10, fontWeight: "800", letterSpacing: 1.1, paddingHorizontal: 12, marginBottom: 10 },
  sidebarNav: { gap: 5 },
  sidebarItem: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 12 },
  sidebarItemActive: { backgroundColor: "#DDEADF" },
  sidebarItemText: { color: "#B7C8BA", fontSize: 14, fontWeight: "600" },
  sidebarItemTextActive: { color: "#26352D", fontWeight: "800" },
  sidebarActiveDot: { width: 5, height: 5, marginLeft: "auto", borderRadius: 3, backgroundColor: "#B75C52" },
  sidebarBottom: { gap: 18, marginTop: "auto" },
  sidebarNote: { padding: 14, borderRadius: 14, backgroundColor: "#314339" },
  sidebarNoteTitle: { color: "#E4EFE6", fontSize: 12, fontWeight: "800" },
  sidebarNoteBody: { color: "#B7C8BA", fontSize: 11, lineHeight: 16, marginTop: 5 },
  webMain: { flex: 1, minWidth: 0 },
  webTopBar: { minHeight: 96, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20, paddingHorizontal: 42, borderBottomWidth: StyleSheet.hairlineWidth },
  webTopBarEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  webTopBarTitle: { fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.9, marginTop: 3 },
  webTopBarActions: { flexDirection: "row", alignItems: "center", gap: 20 },
  webTopBarHint: { fontSize: 12 },
  topBarAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, borderRadius: 12 },
  topBarActionText: { fontSize: 13, fontWeight: "800" },
  webNavigator: { flex: 1, minHeight: 0 },
  webBootPlaceholder: { flex: 1, minHeight: "100%" },
  mobileShell: { flex: 1, minHeight: "100%" },
  mobileContent: { flex: 1, minHeight: 0 },
  mobileNav: { minHeight: 68, flexDirection: "row", justifyContent: "space-around", alignItems: "stretch", borderTopWidth: StyleSheet.hairlineWidth },
  mobileNavItem: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2 },
  mobileNavLabel: { fontSize: 10, fontWeight: "700", textAlign: "center" },
  pressed: { opacity: 0.7 },
});
