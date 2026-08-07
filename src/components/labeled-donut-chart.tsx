import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Circle, Line, Svg } from "react-native-svg";
import { useTheme } from "@/theme";

interface Slice {
  value: number;
  color: string;
  name: string;
}

interface Props {
  slices: Slice[];
  size?: number;
  donutSize?: number;
  strokeWidth?: number;
  labelMaxWidth?: number;
  surfaceColor?: string;
  labelColor?: string;
  outlineColor?: string;
}

const LABEL_CAP = 6; // ponytail: cap donut labels; the summary list shows all
const MIN_PCT = 3;

export function LabeledDonutChart({
  slices,
  size = 340,
  donutSize = 200,
  strokeWidth = 36,
  labelMaxWidth = 58,
  surfaceColor,
  labelColor,
  outlineColor,
}: Props) {
  const theme = useTheme();
  const chartSurface = surfaceColor ?? theme.surface;
  const chartLabel = labelColor ?? theme.label;
  const chartOutline = outlineColor ?? theme.outline;
  const center = size / 2;
  const ringR = (donutSize - strokeWidth) / 2;
  const ringOuter = ringR + strokeWidth / 2;
  const gap = 12;
  const circumference = 2 * Math.PI * ringR;
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) {
    return null;
  }

  const segments: { length: number; offset: number }[] = [];
  let acc = 0;
  for (const s of slices) {
    const length = (s.value / total) * circumference;
    segments.push({ length, offset: acc });
    acc += length;
  }

  const labels = slices
    .map((s, i) => ({ s, i, seg: segments[i] }))
    .filter(({ s }) => (s.value / total) * 100 >= MIN_PCT)
    .slice(0, LABEL_CAP)
    .map(({ s, i, seg }) => {
      const midFrac = (seg.offset + seg.length / 2) / circumference;
      const theta = Math.PI / 2 - 2 * Math.PI * midFrac;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const right = cos >= 0;
      const anchorX = right ? center + ringOuter + gap : center - ringOuter - gap;
      const y1 = center + (ringOuter + gap) * sin;
      return {
        key: i,
        x0: center + ringOuter * cos,
        y0: center + ringOuter * sin,
        x1: center + (ringOuter + gap) * cos,
        y1,
        anchorX,
        right,
        text: `${s.name} ${Math.round((s.value / total) * 100)}%`,
        top: y1 - 8,
      };
    });

  const dashGap = 1.5;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {segments.map((segment, index) => {
          const dash = Math.max(segment.length - dashGap, 0);
          return (
            <Circle
              key={index}
              cx={center}
              cy={center}
              r={ringR}
              stroke={slices[index].color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-segment.offset}
              rotation={-90}
              origin={`${center}, ${center}`}
            />
          );
        })}
        <Circle cx={center} cy={center} r={ringR * 0.62} fill={chartSurface} />
        {labels.map((l) => (
          <Fragment key={l.key}>
            <Line
              x1={l.x0}
              y1={l.y0}
              x2={l.x1}
              y2={l.y1}
              stroke={chartOutline}
              strokeWidth={1}
            />
            <Line
              x1={l.x1}
              y1={l.y1}
              x2={l.anchorX}
              y2={l.y1}
              stroke={chartOutline}
              strokeWidth={1}
            />
          </Fragment>
        ))}
      </Svg>
      {labels.map((l) => (
        <Text
          key={l.key}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.label,
            {
              top: l.top,
              left: l.right ? l.anchorX : l.anchorX - labelMaxWidth,
              width: labelMaxWidth,
              textAlign: l.right ? "left" : "right",
              color: chartLabel,
            },
          ]}
        >
          {l.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
});
