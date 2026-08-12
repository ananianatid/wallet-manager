import { Circle, Svg } from "react-native-svg";

export interface MiniDonutSlice {
  value: number;
  color: string;
}

interface Props {
  slices: MiniDonutSlice[];
  size?: number;
  strokeWidth?: number;
  /** Couleur du fond (anneau vide) sous les segments. */
  trackColor?: string;
  /** Espace en pixels entre deux segments. */
  gap?: number;
}

/** Donut compact sans légende ni libellés, pour les aperçus de l'accueil. */
export function MiniDonut({
  slices,
  size = 96,
  strokeWidth = 14,
  trackColor,
  gap = 2,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (total <= 0) {
    return null;
  }

  // Pré-calcule les segments sans mutation pendant le rendu (React Compiler).
  const segments = slices.reduce<
    { length: number; dash: number; offset: number; color: string }[]
  >(
    (acc, slice) => {
      const length = (slice.value / total) * circumference;
      const prev = acc[acc.length - 1];
      const offset = prev ? prev.offset + prev.length : 0;
      return [
        ...acc,
        { length, dash: Math.max(length - gap, 0), offset, color: slice.color },
      ];
    },
    [],
  );

  return (
    <Svg width={size} height={size}>
      {trackColor ? (
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
      ) : null}
      {segments.map((segment, index) => (
        <Circle
          key={index}
          cx={center}
          cy={center}
          r={radius}
          stroke={segment.color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
          strokeDashoffset={-segment.offset}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      ))}
    </Svg>
  );
}
