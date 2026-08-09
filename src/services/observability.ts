import * as Sentry from "@sentry/react-native";
import { addLogSink, logLevelAtLeast } from "@/utils/logger";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;
let ready = false;

const SENTRY_LEVELS: Record<string, Sentry.SeverityLevel> = {
  debug: "debug",
  info: "info",
  warn: "warning",
  error: "error",
};

const AMOUNT_PATTERNS = [
  /\b\d{1,3}(?:[\s\u00A0\u202F]\d{3})+\s*(?:FCFA|F)\b/,
  /[0-9]{4,}(?:\s+[0-9]{3})+\s*(?:FCFA|F)\b/,
];

function scrub(text: string): string {
  let result = text;
  for (const pattern of AMOUNT_PATTERNS) {
    result = result.replace(pattern, "[montant]");
  }
  return result;
}

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") {
    return scrub(value);
  }
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, scrubValue(nested)]),
    );
  }
  return value;
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.message) {
    event.message = scrub(event.message);
  }
  if (event.extra) {
    event.extra = scrubValue(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) {
      breadcrumb.message = scrub(breadcrumb.message);
    }
    if (breadcrumb.data) {
      breadcrumb.data = scrubValue(breadcrumb.data) as typeof breadcrumb.data;
    }
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = scrub(exception.value);
    }
  }
  return event;
}

export function initObservability(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  addLogSink((entry) => {
    if (!ready || !logLevelAtLeast(entry, "warn")) {
      return;
    }
    Sentry.addBreadcrumb({
      category: entry.context,
      message: entry.message,
      level: SENTRY_LEVELS[entry.level] ?? "info",
      timestamp: Date.parse(entry.ts) / 1000,
    });
    if (entry.level === "error" && entry.error) {
      const error = new Error(entry.error.message);
      error.name = entry.error.name;
      error.stack = entry.error.stack;
      Sentry.captureException(error, {
        tags: { context: entry.context },
        extra: entry.data,
      });
    }
  });

  if (!DSN) {
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "development" : "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    beforeSend: scrubEvent,
  });
  ready = true;
}
