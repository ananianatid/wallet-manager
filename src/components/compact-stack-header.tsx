import { ArrowLeft } from "lucide-react-native";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackHeaderProps } from "expo-router";
import { spacing, useTheme } from "@/theme";

const TOOLBAR_HEIGHT = 35;

export function CompactStackHeader({ back, options, navigation, route }: NativeStackHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const title = options.title ?? route.name;
  const tintColor = options.headerTintColor ?? theme.accent;
  const headerTitleAlign =
    Platform.OS === "ios" ? "center" : (options.headerTitleAlign ?? "left");
  const hasCustomLeft = options.headerLeft != null;
  const shouldShowBack = Boolean(back) && (!hasCustomLeft || options.headerBackVisible === true);

  const titleContent =
    typeof options.headerTitle === "function"
      ? options.headerTitle({ children: title, tintColor })
      : typeof options.headerTitle === "string"
        ? options.headerTitle
        : title;

  const customLeft = hasCustomLeft
    ? options.headerLeft?.({
        tintColor,
        canGoBack: Boolean(back),
        backgroundColor: theme.background,
        label: back?.title,
        href: back?.href,
      })
    : null;
  const customRight = options.headerRight?.({
    tintColor,
    canGoBack: Boolean(back),
    backgroundColor: theme.background,
  });

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: options.headerTransparent ? "transparent" : theme.background,
          paddingTop: insets.top,
        },
      ]}
    >
      {options.headerBackground ? (
        <View style={StyleSheet.absoluteFill}>{options.headerBackground()}</View>
      ) : null}
      <View style={styles.toolbar}>
        <View style={styles.side}>
          {shouldShowBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={8}
              style={styles.backButton}
            >
              <ArrowLeft size={22} strokeWidth={2.2} color={tintColor} />
            </Pressable>
          ) : null}
          {customLeft}
        </View>
        <View
          style={[
            styles.titleContainer,
            headerTitleAlign === "left" ? styles.titleContainerLeft : styles.titleContainerCenter,
          ]}
        >
          {typeof titleContent === "string" ? (
            <Text
              numberOfLines={1}
              style={[styles.title, { color: theme.label }, options.headerTitleStyle]}
            >
              {titleContent}
            </Text>
          ) : (
            titleContent
          )}
        </View>
        <View style={[styles.side, styles.rightSide]}>{customRight}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    overflow: "visible",
  },
  toolbar: {
    height: TOOLBAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  side: {
    minWidth: 48,
    height: TOOLBAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
  },
  rightSide: {
    justifyContent: "flex-end",
  },
  backButton: {
    width: 48,
    height: TOOLBAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    height: TOOLBAR_HEIGHT,
    justifyContent: "center",
  },
  titleContainerLeft: {
    alignItems: "flex-start",
    paddingHorizontal: spacing.sm,
  },
  titleContainerCenter: {
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
});
