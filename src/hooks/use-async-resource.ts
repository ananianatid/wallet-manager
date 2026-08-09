import { useCallback, useRef, useState } from "react";
import { log } from "@/utils/logger";

export type AsyncResourceStatus = "loading" | "ready" | "error";

export interface AsyncResource<T> {
  data: T | null;
  status: AsyncResourceStatus;
  error: Error | null;
  reload: () => Promise<void>;
}

export function useAsyncResource<T>(
  loader: () => Promise<T>,
  context = "data.load",
): AsyncResource<T> {
  const requestId = useRef(0);
  const [state, setState] = useState<{
    data: T | null;
    status: AsyncResourceStatus;
    error: Error | null;
  }>({ data: null, status: "loading", error: null });

  const reload = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setState((current) => ({
      data: current.data,
      status: "loading",
      error: null,
    }));

    try {
      const data = await loader();
      if (requestId.current !== currentRequest) {
        return;
      }
      setState({ data, status: "ready", error: null });
    } catch (cause) {
      if (requestId.current !== currentRequest) {
        return;
      }
      log.error(context, "Échec du chargement des données", cause);
      setState((current) => ({
        data: current.data,
        status: "error",
        error: cause instanceof Error ? cause : new Error("Une erreur est survenue."),
      }));
    }
  }, [loader, context]);

  return { ...state, reload };
}
