import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Pencil, Trash } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { IconButton, KeyboardAwareScreen, ScreenState } from "@/components/ui";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { CategoryIcon } from "@/components/category-icons";
import {
  DEFAULT_CATEGORY_ICON,
  type CategoryIconName,
} from "@/constants/category-icons";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/db/categories";
import { getDatabase } from "@/db/database";
import { useAsyncResource } from "@/hooks/use-async-resource";
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

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<CategoryIconName>(DEFAULT_CATEGORY_ICON);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<CategoryIconName>(DEFAULT_CATEGORY_ICON);
  const [pickerTarget, setPickerTarget] = useState<"new" | "edit" | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    return listCategories(db, categoryType);
  }, [categoryType]);

  const resource = useAsyncResource(load);
  const reload = resource.reload;
  const categories = resource.data ?? [];

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const add = async () => {
    if (!newName.trim()) {
      return;
    }
    try {
      const db = await getDatabase();
      await createCategory(db, {
        type: categoryType,
        name: newName,
        icon: categoryType === "account" ? null : newIcon,
      });
      setNewName("");
      setNewIcon(DEFAULT_CATEGORY_ICON);
      setAdding(false);
      await reload();
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
    setEditIcon(category.icon ?? DEFAULT_CATEGORY_ICON);
  };

  const saveRename = async (id: number) => {
    try {
      const db = await getDatabase();
      await updateCategory(db, id, {
        name: editName,
        icon: categoryType === "account" ? null : editIcon,
      });
      setEditingId(null);
      await reload();
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
              await reload();
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
      {!resource.data ? (
        <ScreenState
          status={resource.status === "error" ? "error" : "loading"}
          message={resource.error?.message}
          onRetry={() => void resource.reload()}
        />
      ) : (
      <KeyboardAwareScreen
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.sm,
        }}
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
                accessibilityLabel="Nom de la nouvelle catégorie"
                maxLength={40}
                style={[
                  styles.input,
                  { backgroundColor: theme.surfaceElevated, color: theme.label },
                ]}
                autoFocus
                onSubmitEditing={add}
                returnKeyType="done"
              />
              {categoryType !== "account" ? (
                <Pressable
                  onPress={() => setPickerTarget("new")}
                  style={({ pressed }) => [
                    styles.iconButton,
                    { backgroundColor: theme.surfaceElevated, borderColor: theme.separator },
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Choisir l’icône de la nouvelle catégorie"
                >
                  <CategoryIcon name={newIcon} size={21} color={theme.accent} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={add}
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: theme.accent },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ color: theme.onAccent, fontWeight: "700" }}>Ajouter</Text>
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
                    accessibilityLabel={`Nom de la catégorie ${category.name}`}
                    maxLength={40}
                    autoFocus
                    onSubmitEditing={() => saveRename(category.id)}
                    returnKeyType="done"
                  />
                  {categoryType !== "account" ? (
                    <Pressable
                      onPress={() => setPickerTarget("edit")}
                      style={({ pressed }) => [
                        styles.iconButton,
                        { backgroundColor: theme.surfaceElevated, borderColor: theme.separator },
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Modifier l’icône de ${category.name}`}
                    >
                      <CategoryIcon name={editIcon} size={21} color={theme.accent} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => saveRename(category.id)}
                    style={({ pressed }) => [
                      styles.addButton,
                      { backgroundColor: theme.accent },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={{ color: theme.onAccent, fontWeight: "700" }}>OK</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.row}>
                  {categoryType !== "account" ? (
                    <View style={[styles.categoryIcon, { backgroundColor: theme.surfaceElevated }]}>
                      <CategoryIcon name={category.icon} size={19} color={theme.accent} />
                    </View>
                  ) : null}
                  <Text style={[styles.name, { color: theme.label }]}>
                    {category.name}
                  </Text>
                  <IconButton
                    label={`Renommer ${category.name}`}
                    onPress={() => startRename(category)}
                    icon={<Pencil size={18} color={theme.secondaryLabel} strokeWidth={2} />}
                  />
                  <IconButton
                    label={`Supprimer ${category.name}`}
                    onPress={() => confirmDelete(category)}
                    icon={<Trash size={18} color={theme.expense} strokeWidth={2} />}
                  />
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
            setNewIcon(DEFAULT_CATEGORY_ICON);
          }}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.accent, alignSelf: "center", paddingHorizontal: spacing.xl },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={{ color: theme.onAccent, fontWeight: "700" }}>
            {adding ? "Annuler" : "+ Ajouter une catégorie"}
          </Text>
        </Pressable>
      </KeyboardAwareScreen>
      )}
      {categoryType !== "account" ? (
        <CategoryIconPicker
          visible={pickerTarget !== null}
          value={pickerTarget === "edit" ? editIcon : newIcon}
          onSelect={(icon) => {
            if (pickerTarget === "edit") {
              setEditIcon(icon);
            } else {
              setNewIcon(icon);
            }
          }}
          onClose={() => setPickerTarget(null)}
        />
      ) : null}
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
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.xl,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  categoryIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
});
