import type { SQLiteDatabase } from "expo-sqlite";
import {
  DEFAULT_CURRENCY_CODE,
  FALLBACK_CURRENCY_DEFINITIONS,
  convertMinorAmount,
  type CurrencyDefinition,
} from "./currencies";
import { getSetting, setSetting } from "@/db/settings";
import { log } from "@/utils/logger";
import { ErrorCodes, errorWithCode } from "@/utils/user-message";

const API_BASE = "https://api.frankfurter.dev/v2";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const PROVIDER = "Frankfurter blended";

export interface CurrencyRate {
  base: string;
  quote: string;
  rate: number;
  date: string;
  provider: string;
  fetchedAt: number;
}

interface ApiRate {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

interface ApiCurrency {
  iso_code: string;
  name: string;
  symbol?: string | null;
}

export const RATE_CACHE_TTL_MS = CACHE_TTL_MS;

export function isValidExchangeRate(rate: number): boolean {
  return Number.isFinite(rate) && rate > 0;
}

function mapCurrency(row: {
  code: string;
  name: string;
  symbol: string | null;
}): CurrencyDefinition {
  return {
    ...row,
    digits: new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: row.code,
    }).resolvedOptions().maximumFractionDigits ?? 2,
  };
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `Frankfurter a répondu ${response.status}.`);
  }
  return (await response.json()) as T;
}

export async function getReferenceCurrency(db: SQLiteDatabase): Promise<string> {
  return (await getSetting(db, "base_currency")) ?? DEFAULT_CURRENCY_CODE;
}

export async function getCachedCurrencies(
  db: SQLiteDatabase,
): Promise<CurrencyDefinition[]> {
  const rows = await db.getAllAsync<{
    code: string;
    name: string;
    symbol: string | null;
  }>("SELECT iso_code AS code, name, symbol FROM currencies ORDER BY name");
  return rows.length > 0 ? rows.map(mapCurrency) : FALLBACK_CURRENCY_DEFINITIONS;
}

export async function hasCachedCurrencyCatalog(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM currencies",
  );
  return (row?.count ?? 0) > 0;
}

export async function refreshCurrencyCatalog(
  db: SQLiteDatabase,
  signal?: AbortSignal,
): Promise<CurrencyDefinition[]> {
  const currencies = await fetchJson<ApiCurrency[]>(`${API_BASE}/currencies`, signal);
  await db.withTransactionAsync(async () => {
    for (const currency of currencies) {
      await db.runAsync(
        `INSERT INTO currencies (iso_code, name, symbol)
         VALUES (?, ?, ?)
         ON CONFLICT(iso_code) DO UPDATE SET name = excluded.name, symbol = excluded.symbol`,
        currency.iso_code,
        currency.name,
        currency.symbol ?? null,
      );
    }
  });
  return currencies.map((currency) => mapCurrency({
    code: currency.iso_code,
    name: currency.name,
    symbol: currency.symbol ?? null,
  }));
}

export async function getCachedRates(
  db: SQLiteDatabase,
  base: string,
): Promise<CurrencyRate[]> {
  const rows = await db.getAllAsync<CurrencyRate>(
    `SELECT base_code AS base, quote_code AS quote, rate, rate_date AS date,
            provider, fetched_at AS fetchedAt
     FROM fx_rates
     WHERE base_code = ?
     ORDER BY quote_code`,
    base,
  );
  return rows;
}

export async function refreshLatestRates(
  db: SQLiteDatabase,
  base: string,
  signal?: AbortSignal,
): Promise<CurrencyRate[]> {
  const payload = await fetchJson<ApiRate[]>(
    `${API_BASE}/rates?base=${encodeURIComponent(base)}`,
    signal,
  );
  const fetchedAt = Date.now();
  const rates: CurrencyRate[] = [
    {
      base,
      quote: base,
      rate: 1,
      date: payload[0]?.date ?? new Date().toISOString().slice(0, 10),
      provider: PROVIDER,
      fetchedAt,
    },
    ...payload
      .filter((item) => isValidExchangeRate(item.rate))
      .map((item) => ({ ...item, provider: PROVIDER, fetchedAt })),
  ];
  if (rates.length === 1) {
    throw new Error("Frankfurter n’a fourni aucun taux de change valide.");
  }
  await db.withTransactionAsync(async () => {
    for (const item of rates) {
      await db.runAsync(
        `INSERT INTO fx_rates (base_code, quote_code, rate, rate_date, provider, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(base_code, quote_code) DO UPDATE SET
           rate = excluded.rate,
           rate_date = excluded.rate_date,
           provider = excluded.provider,
           fetched_at = excluded.fetched_at`,
        item.base,
        item.quote,
        item.rate,
        item.date,
        item.provider,
        item.fetchedAt,
      );
    }
  });
  await setSetting(db, "currency_last_refresh", String(fetchedAt));
  return rates;
}

export async function ensureCurrentRates(
  db: SQLiteDatabase,
  base: string,
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<{ rates: CurrencyRate[]; stale: boolean; refreshed: boolean }> {
  const cached = await getCachedRates(db, base);
  const lastRefresh = Number(await getSetting(db, "currency_last_refresh"));
  const fresh = cached.length > 0 && Number.isFinite(lastRefresh) && Date.now() - lastRefresh < CACHE_TTL_MS;
  if (fresh && !options.force) {
    return { rates: cached, stale: false, refreshed: false };
  }
  try {
    const rates = await refreshLatestRates(db, base, options.signal);
    return { rates, stale: false, refreshed: true };
  } catch (cause) {
    log.warn("currency", "Actualisation des taux impossible, cache utilisé", cause, {
      base,
      cachedCount: cached.length,
    });
    return { rates: cached, stale: true, refreshed: false };
  }
}

function rateFromRows(
  rows: CurrencyRate[],
  from: string,
  to: string,
): CurrencyRate | null {
  if (from === to) {
    return {
      base: from,
      quote: to,
      rate: 1,
      date: new Date().toISOString().slice(0, 10),
      provider: "same currency",
      fetchedAt: Date.now(),
    };
  }
  const direct = rows.find((row) => row.base === from && row.quote === to);
  if (direct && isValidExchangeRate(direct.rate)) return direct;
  const fromBase = rows.find((row) => row.base === rows[0]?.base && row.quote === from);
  const toBase = rows.find((row) => row.base === rows[0]?.base && row.quote === to);
  if (
    !fromBase ||
    !toBase ||
    !isValidExchangeRate(fromBase.rate) ||
    !isValidExchangeRate(toBase.rate)
  ) {
    return null;
  }
  return {
    base: from,
    quote: to,
    rate: toBase.rate / fromBase.rate,
    date: toBase.date,
    provider: toBase.provider,
    fetchedAt: Math.min(fromBase.fetchedAt, toBase.fetchedAt),
  };
}

export async function getRateForPair(
  db: SQLiteDatabase,
  from: string,
  to: string,
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<CurrencyRate | null> {
  if (from === to) {
    return rateFromRows([], from, to);
  }
  const base = await getReferenceCurrency(db);
  const snapshot = await ensureCurrentRates(db, base, options);
  const computed = rateFromRows(snapshot.rates, from, to);
  if (computed) return computed;
  const cachedDirect = await db.getFirstAsync<CurrencyRate>(
    `SELECT base_code AS base, quote_code AS quote, rate, rate_date AS date,
            provider, fetched_at AS fetchedAt
     FROM fx_rates
     WHERE base_code = ? AND quote_code = ?`,
    from,
    to,
  );
  if (cachedDirect && isValidExchangeRate(cachedDirect.rate)) return cachedDirect;
  try {
    const item = await fetchJson<ApiRate>(
      `${API_BASE}/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
      options.signal,
    );
    if (!isValidExchangeRate(item.rate)) {
      throw new Error("Le taux reçu est invalide.");
    }
    const rate: CurrencyRate = { ...item, provider: PROVIDER, fetchedAt: Date.now() };
    await db.runAsync(
      `INSERT INTO fx_rates (base_code, quote_code, rate, rate_date, provider, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(base_code, quote_code) DO UPDATE SET
         rate = excluded.rate, rate_date = excluded.rate_date,
         provider = excluded.provider, fetched_at = excluded.fetched_at`,
      rate.base,
      rate.quote,
      rate.rate,
      rate.date,
      rate.provider,
      rate.fetchedAt,
    );
    return rate;
  } catch (cause) {
    log.warn("currency", "Taux direct indisponible", cause, { from, to });
    return null;
  }
}

export async function setReferenceCurrency(
  db: SQLiteDatabase,
  nextCurrency: string,
): Promise<void> {
  const current = await getReferenceCurrency(db);
  if (current === nextCurrency) return;
  const rate = await getRateForPair(db, current, nextCurrency, { force: true });
  if (!rate) {
    throw errorWithCode(ErrorCodes.RATE_UNAVAILABLE, `Taux indisponible pour ${current}/${nextCurrency}.`);
  }
  await db.withTransactionAsync(async () => {
    const budgets = await db.getAllAsync<{
      id: number;
      amount: number;
      currencyCode: string;
    }>("SELECT id, amount, currency_code AS currencyCode FROM budgets");
    for (const budget of budgets) {
      await db.runAsync(
        "UPDATE budgets SET amount = ?, currency_code = ? WHERE id = ?",
        convertMinorAmount(budget.amount, budget.currencyCode, nextCurrency, rate.rate),
        nextCurrency,
        budget.id,
      );
    }
    const budgetPeriods = await db.getAllAsync<{
      id: number;
      amount: number;
      planCurrencyCode: string;
    }>(
      `SELECT bp.id,
              bp.amount,
              plans.currency_code AS planCurrencyCode
       FROM budget_periods bp
       JOIN budget_plans plans ON plans.id = bp.plan_id`,
    );
    for (const period of budgetPeriods) {
      await db.runAsync(
        "UPDATE budget_periods SET amount = ? WHERE id = ?",
        convertMinorAmount(period.amount, period.planCurrencyCode, nextCurrency, rate.rate),
        period.id,
      );
    }
    const budgetPlans = await db.getAllAsync<{
      id: number;
      amount: number;
      currencyCode: string;
    }>("SELECT id, amount, currency_code AS currencyCode FROM budget_plans");
    for (const plan of budgetPlans) {
      await db.runAsync(
        "UPDATE budget_plans SET amount = ?, currency_code = ? WHERE id = ?",
        convertMinorAmount(plan.amount, plan.currencyCode, nextCurrency, rate.rate),
        nextCurrency,
        plan.id,
      );
    }
    const goals = await db.getAllAsync<{
      id: number;
      amount: number;
      currencyCode: string;
    }>("SELECT id, target_amount AS amount, currency_code AS currencyCode FROM goals");
    for (const goal of goals) {
      await db.runAsync(
        "UPDATE goals SET target_amount = ?, currency_code = ? WHERE id = ?",
        convertMinorAmount(goal.amount, goal.currencyCode, nextCurrency, rate.rate),
        nextCurrency,
        goal.id,
      );
    }
    const reservations = await db.getAllAsync<{
      id: number;
      amount: number;
      currencyCode: string;
    }>(
      "SELECT id, reference_amount AS amount, reference_currency AS currencyCode FROM goal_reservations WHERE released_at IS NULL",
    );
    for (const reservation of reservations) {
      await db.runAsync(
        `UPDATE goal_reservations
         SET reference_amount = ?, reference_currency = ?, exchange_rate = ?,
             exchange_rate_date = ?, exchange_rate_provider = ?
         WHERE id = ?`,
        convertMinorAmount(reservation.amount, reservation.currencyCode, nextCurrency, rate.rate),
        nextCurrency,
        rate.rate,
        rate.date,
        rate.provider,
        reservation.id,
      );
    }
    await setSetting(db, "base_currency", nextCurrency);
  });
}

export const changeReferenceCurrency = setReferenceCurrency;

export function latestRateTimestamp(rates: CurrencyRate[]): number | null {
  if (rates.length === 0) return null;
  return Math.max(...rates.map((rate) => rate.fetchedAt));
}
