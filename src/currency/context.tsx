import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState } from "react-native";
import { getDatabase } from "@/db/database";
import {
  ensureCurrentRates,
  getCachedCurrencies,
  hasCachedCurrencyCatalog,
  getReferenceCurrency,
  latestRateTimestamp,
  refreshCurrencyCatalog,
  type CurrencyRate,
} from "./service";
import { DEFAULT_CURRENCY_CODE, type CurrencyDefinition } from "./currencies";
import {
  convertWithIndexedRates,
  indexCurrencyRates,
} from "./rate-index";

interface CurrencyContextValue {
  baseCurrency: string;
  currencies: CurrencyDefinition[];
  rates: CurrencyRate[];
  stale: boolean;
  loading: boolean;
  lastRefresh: number | null;
  refresh: (force?: boolean) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: PropsWithChildren) {
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_CURRENCY_CODE);
  const [currencies, setCurrencies] = useState<CurrencyDefinition[]>([]);
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const db = await getDatabase();
      const base = await getReferenceCurrency(db);
      setBaseCurrency(base);
      const cachedCurrencies = await getCachedCurrencies(db);
      const hasCatalog = await hasCachedCurrencyCatalog(db);
      setCurrencies(cachedCurrencies);
      const snapshot = await ensureCurrentRates(db, base, {
        force,
        signal: controller.signal,
      });
      setRates(snapshot.rates);
      setStale(snapshot.stale);
      if (!hasCatalog || force) {
        try {
          setCurrencies(await refreshCurrencyCatalog(db, controller.signal));
        } catch {
          // The fallback catalog remains available offline.
        }
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setStale(true);
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      refreshingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = setTimeout(() => void refresh(), 0);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      clearTimeout(initialRefresh);
      subscription.remove();
      controllerRef.current?.abort();
    };
  }, [refresh]);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      baseCurrency,
      currencies,
      rates,
      stale,
      loading,
      lastRefresh: latestRateTimestamp(rates),
      refresh,
    }),
    [baseCurrency, currencies, loading, rates, refresh, stale],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  return context ?? {
    baseCurrency: DEFAULT_CURRENCY_CODE,
    currencies: [],
    rates: [],
    stale: true,
    loading: false,
    lastRefresh: null,
    refresh: async () => undefined,
  };
}

export function useCurrencyConverter() {
  const { baseCurrency, rates } = useCurrency();
  const indexedRates = useMemo(() => indexCurrencyRates(rates), [rates]);
  return useCallback(
    (amount: number, fromCurrency: string, toCurrency = baseCurrency): number | null =>
      convertWithIndexedRates(
        amount,
        fromCurrency,
        toCurrency,
        indexedRates,
      ),
    [baseCurrency, indexedRates],
  );
}
