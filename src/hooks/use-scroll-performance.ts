import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  isPerformanceProfilingEnabled,
  recordPerformanceSample,
} from "@/services/performance";

export function useScrollPerformance(label: string) {
  const previousAt = useRef<number | null>(null);

  return useCallback(
    (_event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isPerformanceProfilingEnabled()) return;
      const currentAt = globalThis.performance?.now?.() ?? Date.now();
      const previous = previousAt.current;
      previousAt.current = currentAt;
      if (previous != null) {
        recordPerformanceSample(`${label}.frame`, currentAt - previous);
      }
    },
    [label],
  );
}
