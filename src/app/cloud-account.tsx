import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ActionButton, FormField, InlineError, KeyboardAwareScreen } from "@/components/ui";
import { useCloudAuth } from "@/cloud/auth-context";
import { deleteCloudAccount, listCloudSessions, loadCloudBootstrap, requestPasswordReset, revokeCloudSession, type CloudSession } from "@/cloud/api";
import { getDatabase } from "@/db/database";
import { getSetting } from "@/db/settings";
import { spacing, typography, useTheme } from "@/theme";

export default function CloudAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status, user, signIn, signUp, signOut, refreshUser, resendVerification, syncNow } = useCloudAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [sessions, setSessions] = useState<CloudSession[]>([]);
  const [deletePassword, setDeletePassword] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    void listCloudSessions().then(setSessions).catch(() => setSessions([]));
  }, [status]);

  const synchronize = () => {
    if (Platform.OS === "web") {
      void loadCloudBootstrap()
        .then((result) => setSyncMessage(`${result.entities.filter((entity) => entity.payload !== null).length} élément(s) cloud chargé(s) depuis PostgreSQL.`))
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Chargement cloud impossible."));
      return;
    }
    const execute = () => void syncNow()
      .then((result) => setSyncMessage(result.conflicts.length > 0 ? `${result.conflicts.length} conflit(s) à résoudre.` : `${result.pushed} élément(s) envoyé(s), ${result.pulled} reçu(s).`))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Synchronisation impossible."));
    void getDatabase().then((db) => getSetting(db, "cloud_sync_initialized")).then((initialized) => {
      if (initialized === "1") execute();
      else Alert.alert("Première synchronisation", "Wallet va comparer les données locales et cloud. Vous pourrez choisir la version à garder en cas de conflit.", [{ text: "Annuler", style: "cancel" }, { text: "Continuer", onPress: execute }]);
    });
  };

  const scheduleDeletion = () => {
    if (!deletePassword) return;
    Alert.alert("Programmer la suppression ?", "Votre compte cloud sera désactivé immédiatement et supprimé après 30 jours. Un lien de récupération vous sera envoyé par email.", [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", style: "destructive", onPress: () => void deleteCloudAccount(deletePassword).then(() => signOut()).catch((cause) => setError(cause instanceof Error ? cause.message : "Suppression impossible.")) },
    ]);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = mode === "login" ? await signIn(email, password) : await (async () => {
        if (password !== passwordConfirmation) {
          setError("Les mots de passe ne correspondent pas.");
          return null;
        }
        return signUp(email, password);
      })();
      if (Platform.OS === "web" && next?.emailVerified) router.replace("/app");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de contacter le serveur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Compte et synchronisation" }} />
      <KeyboardAwareScreen contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={[styles.title, { color: theme.label }]}>Vos données partout</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>Créez un compte pour retrouver votre portefeuille sur Android et sur PC. Wallet reste utilisable sans compte.</Text>
        </View>
        {status === "authenticated" && user ? (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.label }]}>Compte connecté</Text>
            <Text style={[styles.email, { color: theme.label }]}>{user.email}</Text>
            <Text style={[styles.hint, { color: theme.secondaryLabel }]}>
              {user.emailVerified
                ? Platform.OS === "web" ? "Adresse vérifiée. Vos données sont enregistrées dans PostgreSQL." : "Adresse vérifiée. La synchronisation peut être activée."
                : "Vérifiez votre adresse email pour activer la synchronisation."}
            </Text>
            {!user.emailVerified ? (
              <View style={styles.inlineActions}>
                <ActionButton label="Renvoyer l’email" variant="secondary" onPress={() => void resendVerification().then(() => setSyncMessage("Email de vérification renvoyé.")).catch((cause) => setError(cause instanceof Error ? cause.message : "Envoi impossible."))} />
                <ActionButton label="Actualiser le statut" variant="secondary" onPress={() => void refreshUser().then(() => setSyncMessage("Statut du compte actualisé.")).catch((cause) => setError(cause instanceof Error ? cause.message : "Actualisation impossible."))} />
              </View>
            ) : null}
            {user.emailVerified ? (
              <ActionButton
                label={Platform.OS === "web" ? "Charger mes données cloud" : "Synchroniser maintenant"}
                variant="secondary"
                onPress={synchronize}
              />
            ) : null}
            {syncMessage ? <Text style={[styles.hint, { color: theme.income }]}>{syncMessage}</Text> : null}
            <ActionButton label="Centre de conflits" variant="secondary" onPress={() => router.push("/sync-conflicts")} />
            <Text style={[styles.sectionLabel, { color: theme.label }]}>Appareils et sessions</Text>
            {sessions.length === 0 ? <Text style={[styles.hint, { color: theme.secondaryLabel }]}>Aucune session active trouvée.</Text> : sessions.map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <View style={styles.sessionDetails}>
                  <Text style={[styles.sessionName, { color: theme.label }]}>{session.deviceName}</Text>
                  <Text style={[styles.hint, { color: theme.secondaryLabel }]}>Dernière activité : {new Date(session.lastSeenAt).toLocaleString()}</Text>
                </View>
                <ActionButton label="Révoquer" variant="secondary" onPress={() => void revokeCloudSession(session.id).then(() => setSessions((current) => current.filter((item) => item.id !== session.id))).catch((cause) => setError(cause instanceof Error ? cause.message : "Révocation impossible."))} />
              </View>
            ))}
            <Text style={[styles.sectionLabel, { color: theme.label }]}>Suppression du compte</Text>
            <Text style={[styles.hint, { color: theme.secondaryLabel }]}>Le mode invité et les données locales ne sont pas supprimés. Le compte cloud peut être récupéré pendant 30 jours.</Text>
            <TextInput value={deletePassword} onChangeText={setDeletePassword} secureTextEntry placeholder="Mot de passe pour confirmer" placeholderTextColor={theme.secondaryLabel} style={[styles.input, { color: theme.label, borderColor: theme.separator, backgroundColor: theme.background }]} />
            <ActionButton label="Programmer la suppression" variant="secondary" onPress={scheduleDeletion} disabled={!deletePassword} />
            <ActionButton label="Se déconnecter" variant="secondary" onPress={() => void signOut()} />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {forgotMode ? (
              <>
                <Text style={[styles.cardTitle, { color: theme.label }]}>Mot de passe oublié ?</Text>
                {error ? <InlineError message={error} onRetry={() => setError(null)} /> : null}
                <FormField label="Adresse email">
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    placeholder="vous@exemple.com"
                    placeholderTextColor={theme.secondaryLabel}
                    style={[styles.input, { color: theme.label, borderColor: theme.separator, backgroundColor: theme.background }]}
                  />
                </FormField>
                <ActionButton label="Envoyer le lien" onPress={() => void requestPasswordReset(email).then(() => setSyncMessage("Si cette adresse existe, un lien a été envoyé.")).catch((cause) => setError(cause instanceof Error ? cause.message : "Demande impossible."))} disabled={!email.trim()} />
                <ActionButton label="Retour à la connexion" variant="secondary" onPress={() => { setForgotMode(false); setError(null); }} />
              </>
            ) : <>
            <View style={styles.switcher}>
              {(["login", "register"] as const).map((item) => (
                <Pressable key={item} onPress={() => { setMode(item); setError(null); }} accessibilityRole="button" accessibilityState={{ selected: mode === item }}>
                  <Text style={[styles.switchLabel, { color: mode === item ? theme.accent : theme.secondaryLabel }]}>
                    {item === "login" ? "Se connecter" : "Créer un compte"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {error ? <InlineError message={error} onRetry={() => setError(null)} /> : null}
            <FormField label="Adresse email">
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="vous@exemple.com"
                placeholderTextColor={theme.secondaryLabel}
                style={[styles.input, { color: theme.label, borderColor: theme.separator, backgroundColor: theme.background }]}
              />
            </FormField>
            <FormField label="Mot de passe" hint="8 caractères minimum.">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === "login" ? "password" : "new-password"}
                placeholder="Votre mot de passe"
                placeholderTextColor={theme.secondaryLabel}
                style={[styles.input, { color: theme.label, borderColor: theme.separator, backgroundColor: theme.background }]}
                />
            </FormField>
            {mode === "register" ? (
              <FormField label="Confirmer le mot de passe">
                <TextInput
                  value={passwordConfirmation}
                  onChangeText={setPasswordConfirmation}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="Répétez votre mot de passe"
                  placeholderTextColor={theme.secondaryLabel}
                  style={[styles.input, { color: theme.label, borderColor: theme.separator, backgroundColor: theme.background }]}
                />
              </FormField>
            ) : null}
            <ActionButton label={busy ? "Connexion…" : mode === "login" ? "Se connecter" : "Créer mon compte"} onPress={() => void submit()} disabled={busy || !email.trim() || password.length < 8} />
            {mode === "login" ? <Pressable onPress={() => { setForgotMode(true); setError(null); }} accessibilityRole="button"><Text style={[styles.link, { color: theme.accent }]}>Mot de passe oublié ?</Text></Pressable> : null}
            <Text style={[styles.hint, { color: theme.secondaryLabel }]}>La synchronisation sera activée après vérification de votre adresse email. Vos données locales restent disponibles sans compte.</Text>
            </>}
          </View>
        )}
      </KeyboardAwareScreen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl },
  intro: { gap: spacing.sm },
  title: { ...typography.display },
  subtitle: { ...typography.body, lineHeight: 22 },
  card: { padding: spacing.lg, borderRadius: 20, gap: spacing.md },
  cardTitle: { ...typography.section },
  email: { fontSize: 17, fontWeight: "700" },
  hint: { fontSize: 13, lineHeight: 19 },
  switcher: { flexDirection: "row", gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#D7DAD5", paddingBottom: spacing.sm },
  switchLabel: { fontWeight: "700", fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: 16 },
  inlineActions: { gap: spacing.sm },
  link: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  sectionLabel: { fontSize: 15, fontWeight: "700", marginTop: spacing.sm },
  sessionRow: { gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#D7DAD5" },
  sessionDetails: { gap: 3 },
  sessionName: { fontSize: 14, fontWeight: "700" },
});
