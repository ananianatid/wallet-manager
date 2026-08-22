import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { ActionButton, InlineError, KeyboardAwareScreen, ScreenState } from "@/components/ui";
import {
  addLocalTransactionAttachment,
  loadLocalTransactionAttachments,
  loadLocalTransactionDetail,
  removeLocalTransactionAttachment,
} from "@/data/transaction-detail";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { spacing, useTheme } from "@/theme";
import { formatAmount, formatDate, formatTime } from "@/utils/format";
import { userMessage } from "@/utils/user-message";

export default function TransactionDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const transactionId = Number(id);
  const load = useCallback(() => loadLocalTransactionDetail(transactionId), [transactionId]);
  const resource = useAsyncResource(load, "transaction.detail");
  const reload = resource.reload;
  const [attachments, setAttachments] = useState<Awaited<ReturnType<typeof loadLocalTransactionAttachments>>>([]);
  const reloadAttachments = useCallback(async () => {
    setAttachments(await loadLocalTransactionAttachments(transactionId));
  }, [transactionId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void reloadAttachments();
    }, [reload, reloadAttachments]),
  );

  if (!resource.data && resource.status !== "ready") {
    return (
      <ScreenState
        status={resource.status === "error" ? "error" : "loading"}
        message={userMessage(resource.error)}
        onRetry={() => void resource.reload()}
      />
    );
  }
  if (!resource.data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
        <Text style={{ color: theme.secondaryLabel }}>Transaction introuvable.</Text>
      </View>
    );
  }

  const { transaction, splits, reimbursements } = resource.data;
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      await addLocalTransactionAttachment(
        transaction.id,
        asset.uri,
        asset.fileName ?? "image.jpg",
        asset.mimeType ?? "image/jpeg",
      );
      await reloadAttachments();
    } catch (error) {
      Alert.alert("Pièce jointe impossible", userMessage(error));
    }
  };
  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      await addLocalTransactionAttachment(
        transaction.id,
        asset.uri,
        asset.name,
        asset.mimeType ?? "application/pdf",
      );
      await reloadAttachments();
    } catch (error) {
      Alert.alert("Pièce jointe impossible", userMessage(error));
    }
  };
  return (
    <>
      <Stack.Screen
        options={{
          title: "Détail de la transaction",
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: "/new-transaction", params: { id: String(transaction.id) } })}
              accessibilityRole="button"
              accessibilityLabel="Modifier la transaction"
            >
              <Text style={{ color: theme.accent, fontWeight: "700" }}>Modifier</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={{ color: theme.label, fontSize: 28, fontWeight: "800" }}>
            {transaction.type === "income" ? "+" : transaction.type === "expense" ? "−" : ""}
            {formatAmount(transaction.amount, transaction.accountCurrencyCode)}
          </Text>
          <Text selectable style={{ color: theme.secondaryLabel }}>
            {formatDate(transaction.transactionDate)} · {formatTime(transaction.transactionDate)} · {transaction.accountName}
          </Text>
          {transaction.note ? <Text selectable style={{ color: theme.label }}>{transaction.note}</Text> : null}
        </View>

        {splits.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: theme.label, fontWeight: "700" }}>Répartition</Text>
            {splits.map((split) => (
              <View key={split.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.secondaryLabel }}>{split.categoryName ?? "Sans catégorie"}</Text>
                <Text selectable style={{ color: theme.label, fontWeight: "600" }}>
                  {formatAmount(split.amount, transaction.accountCurrencyCode)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {reimbursements.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: theme.label, fontWeight: "700" }}>Remboursements</Text>
            {reimbursements.map((reimbursement) => (
              <View key={reimbursement.id} style={{ gap: spacing.xs }}>
                <Text style={{ color: theme.label, fontWeight: "600" }}>
                  {reimbursement.personName} · {reimbursement.direction === "owed_to_me" ? "On me doit" : "Je dois"}
                </Text>
                <Text selectable style={{ color: theme.secondaryLabel }}>
                  Dû {formatAmount(reimbursement.amount, transaction.accountCurrencyCode)} · Réglé {formatAmount(reimbursement.settledAmount, transaction.accountCurrencyCode)} · Solde {formatAmount(reimbursement.remainingAmount, transaction.accountCurrencyCode)}
                </Text>
                {reimbursement.remainingAmount > 0 ? (
                  <ActionButton
                    label="Enregistrer le règlement"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/reimbursement-settlement" as never,
                        params: { id: String(reimbursement.id) },
                      })
                    }
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ gap: spacing.md }}>
          <Text style={{ color: theme.label, fontWeight: "700" }}>Justificatifs</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}><ActionButton label="Ajouter une image" variant="secondary" onPress={() => void pickImage()} /></View>
            <View style={{ flex: 1 }}><ActionButton label="Ajouter un PDF" variant="secondary" onPress={() => void pickPdf()} /></View>
          </View>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.label }}>{attachment.originalName}</Text>
                <Text style={{ color: attachment.exists ? theme.secondaryLabel : theme.expense, fontSize: 12 }}>
                  {attachment.exists ? `${attachment.mimeType} · ${attachment.size} octets` : "Fichier manquant"}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert("Supprimer le justificatif ?", "La transaction sera conservée.", [
                    { text: "Annuler", style: "cancel" },
                    { text: "Supprimer", style: "destructive", onPress: async () => {
                      await removeLocalTransactionAttachment(attachment.id);
                      await reloadAttachments();
                    } },
                  ])
                }
                accessibilityRole="button"
                accessibilityLabel={`Supprimer ${attachment.originalName}`}
              >
                <Text style={{ color: theme.expense, fontWeight: "700" }}>Supprimer</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {resource.status === "error" ? (
          <InlineError message={userMessage(resource.error)} onRetry={() => void resource.reload()} />
        ) : null}
      </KeyboardAwareScreen>
    </>
  );
}
