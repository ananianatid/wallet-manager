import { StyleSheet, Text, View } from "react-native";
import { Circle, Svg } from "react-native-svg";

interface Props {
  /** Progression de 0 à 100. */
  progress: number;
  color: string;
  trackColor: string;
  labelColor?: string;
  size?: number;
  strokeWidth?: number;
  accessibilityLabel?: string;
}

/** Anneau de progression (cercle de complétion) utilisé pour les objectifs. */
export function ProgressRing({
  progress,
  color,
  trackColor,
  labelColor,
  size = 44,
  strokeWidth = 5,
  accessibilityLabel,
}: Props) {
  const clamped = Math.max(0, Math.min(progress, 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${Math.round(clamped)} %`}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text
          style={{
            color: labelColor,
            fontSize: size * 0.22,
            fontWeight: "800",
            fontVariant: ["tabular-nums"],
          }}
        >
          {Math.round(clamped)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
