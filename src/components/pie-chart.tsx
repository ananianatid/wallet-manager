import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/theme";

interface Slice {
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  size?: number;
  strokeWidth?: number;
}

export function PieChart({ slices, size = 180, strokeWidth = 30 }: Props) {
  const theme = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) {
    return null;
  }

  const segments = slices.reduce<{ length: number; offset: number }[]>(
    (acc, slice) => {
      const length = (slice.value / total) * circumference;
      const previous = acc.length > 0 ? acc[acc.length - 1] : null;
      acc.push({
        length,
        offset: previous ? previous.offset + previous.length : 0,
      });
      return acc;
    },
    [],
  );
  const gap = 1.5;

  return (
    <Svg width={size} height={size}>
      {segments.map((segment, index) => {
        const dash = Math.max(segment.length - gap, 0);
        const dasharray = `${dash} ${circumference - dash}`;
        const dashoffset = -segment.offset;
        return (
          <Circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={slices[index].color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        );
      })}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius * 0.62}
        fill={theme.surface}
      />
    </Svg>
  );
}
