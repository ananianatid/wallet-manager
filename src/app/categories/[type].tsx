import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
} from "@/db/categories";
import { getDatabase } from "@/db/database";
import { radius, spacing, useTheme } from "@/theme";
import type { Category, CategoryType } from "@/types";

const TITLES: Record<CategoryType, string> = {
  account: "Catégories de comptes",
  income: "Catégories de revenus",
  expense: "Catégories de dépenses",
};

export default function CategoriesByTypeScreen() {
  const theme = useTheme();
  const { type } = useLocalSearchParams<{ type: string }>();
  const categoryType: CategoryType =
    type === "account" || type === "income" || type === "expense"
      ? type
      : "expense";

  const [categories, setCategories] = useState<Category[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const db = await getDatabase();
    setCategories(await listCategories(db, categoryType));
  }, [categoryType]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const add = async () => {
    if (!newName.trim()) {
      return;
    }
    try {
      const db = await getDatabase();
      await createCategory(db, { type: categoryType, name: newName });
      setNewName("");
      setAdding(false);
      await load();
    } catch (e) {
      Alert.alert(
        "Impossible d'ajouter",
        e instanceof Error ? e.message : "Une erreur est survenue.",
      );
    }
  };

  const startRename = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
  };

  const saveRename = async (id: number) => {
    try {
      const db = await getDatabase();
      await renameCategory(db, id, editName);
      setEditingId(null);
      await load();
    } catch (e) {
      Alert.alert(
        "Impossible de renommer",
        e instanceof Error ? e.message : "Une erreur est survenue.",
      );
    }
  };

  const confirmDelete = (category: Category) => {
    Alert.alert(
      `Supprimer « ${category.name} » ?`,
      "Cette action est définitive.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await deleteCategory(db, category.id);
              await load();
            } catch (e) {
              Alert.alert(
                "Suppression impossible",
                e instanceof Error ? e.message : "Une erreur est survenue.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: TITLES[categoryType] }} />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.sm,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: radius.lg,
            borderCurve: "continuous",
          }}
        >
          {adding ? (
            <View style={[styles.row, { gap: spacing.sm }]}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Nouvelle catégorie"
                placeholderTextColor={theme.secondaryLabel}
                style={[
                  styles.input,
                  { backgroundColor: theme.surfaceElevated, color: theme.label },
                ]}
                autoFocus
                onSubmitEditing={add}
                returnKeyType="done"
              />
              <Pressable
                onPress={add}
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: theme.accent },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>Ajouter</Text>
              </Pressable>
            </View>
          ) : null}

          {categories.map((category, index) => (
            <View key={category.id}>
              {index > 0 || adding ? (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: theme.separator,
                    marginLeft: spacing.lg,
                  }}
                />
              ) : null}
              {editingId === category.id ? (
                <View style={[styles.row, { gap: spacing.sm }]}>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    style={[
                      styles.input,
                      { backgroundColor: theme.surfaceElevated, color: theme.label },
                    ]}
                    autoFocus
                    onSubmitEditing={() => saveRename(category.id)}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => saveRename(category.id)}
                    style={({ pressed }) => [
                      styles.addButton,
                      { backgroundColor: theme.accent },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>OK</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.row}>
                  <Text style={[styles.name, { color: theme.label }]}>
                    {category.name}
                  </Text>
                  <Pressable
                    onPress={() => startRename(category)}
                    hitSlop={8}
                    accessibilityLabel={`Renommer ${category.name}`}
                  >
                    <Text style={{ color: theme.secondaryLabel, fontSize: 13 }}>
                      Modifier
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(category)}
                    hitSlop={8}
                    accessibilityLabel={`Supprimer ${category.name}`}
                  >
                    <Text style={{ color: theme.expense, fontSize: 13 }}>
                      Supprimer
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}

          {categories.length === 0 && !adding ? (
            <Text
              style={{
                color: theme.secondaryLabel,
                textAlign: "center",
                paddingVertical: spacing.xl,
              }}
            >
              Aucune catégorie.
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => {
            setAdding((v) => !v);
            setNewName("");
          }}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.accent, alignSelf: "center", paddingHorizontal: spacing.xl },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={{ color: "#0A0A0B", fontWeight: "700" }}>
            {adding ? "Annuler" : "+ Ajouter une catégorie"}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  name: {
    flex: 1,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  addButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
});
