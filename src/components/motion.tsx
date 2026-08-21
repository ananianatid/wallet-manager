import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  Platform,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export const motion = {
  micro: 110,
  standard: 180,
  overlay: 220,
  entrance: 320,
} as const;

export type TabAnimation = "none" | "shift";

export function getTabAnimation(platform: string, reducedMotion: boolean): TabAnimation {
  return platform === "android" && !reducedMotion ? "shift" : "none";
}

export function useReduceMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReducedMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

type AnimatedPressableProps = Omit<PressableProps, "style"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const NativeAnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({
  children,
  disabled = false,
  style,
  ...props
}: AnimatedPressableProps) {
  const reducedMotion = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const animateScale = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: reducedMotion ? 0 : motion.micro,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  return (
    <NativeAnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        animateScale(disabled ? 1 : 0.975);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateScale(1);
        props.onPressOut?.(event);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </NativeAnimatedPressable>
  );
}

export function MotionEntrance({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const [translateY] = useState(() => new Animated.Value(reducedMotion ? 0 : 10));

  useEffect(() => {
    opacity.setValue(reducedMotion ? 1 : 0);
    translateY.setValue(reducedMotion ? 0 : 10);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        delay: reducedMotion ? 0 : delay,
        duration: reducedMotion ? 0 : motion.entrance,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        delay: reducedMotion ? 0 : delay,
        duration: reducedMotion ? 0 : motion.entrance,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, opacity, reducedMotion, translateY]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
