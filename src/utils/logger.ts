import { randomUUID } from "expo-crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogErrorDetail {
  name: string;
  message: string;
  code?: string;
  stack?: string;
}

export interface LogEntry {
  ts: string;
  level: LogLevel;
  context: string;
  message: string;
  sessionId: string;
  error?: LogErrorDetail;
  data?: Record<string, unknown>;
}

export type LogSink = (entry: LogEntry) => void;

const RING_CAPACITY = 200;

const sinks = new Set<LogSink>();
const ring: LogEntry[] = [];

let sessionId: string;
try {
  sessionId = randomUUID() || `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
} catch {
  sessionId = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function serializeError(error: unknown): LogErrorDetail | undefined {
  if (error === null || error === undefined) {
    return undefined;
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as { code?: string }).code,
      stack: error.stack,
    };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }
  return { name: "UnknownError", message: String(error) };
}

function push(entry: LogEntry): void {
  ring.push(entry);
  if (ring.length > RING_CAPACITY) {
    ring.splice(0, ring.length - RING_CAPACITY);
  }
  for (const sink of sinks) {
    try {
      sink(entry);
    } catch {
      // A sink must never break the logger.
    }
  }
}

function write(
  level: LogLevel,
  context: string,
  message: string,
  error?: unknown,
  data?: Record<string, unknown>,
): void {
  if (__DEV__) {
    const head = `[${level.toUpperCase()}] ${context}: ${message}`;
    const detail = error instanceof Error ? `\n${error.stack ?? error.message}` : "";
    const suffix = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : "";
    if (level === "error") {
      console.error(head + suffix + detail);
    } else if (level === "warn") {
      console.warn(head + suffix + detail);
    } else {
      console.log(head + suffix);
    }
  }
  push({
    ts: new Date().toISOString(),
    level,
    context,
    message,
    sessionId,
    error: serializeError(error),
    data,
  });
}

export function addLogSink(sink: LogSink): () => void {
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}

export function getRecentLogs(count = 50): LogEntry[] {
  return ring.slice(-count);
}

export function getSessionId(): string {
  return sessionId;
}

export function getRingBuffer(): LogEntry[] {
  return ring.slice();
}

export function clearLogs(): void {
  ring.length = 0;
}

export function logLevelAtLeast(entry: LogEntry, level: LogLevel): boolean {
  return LEVEL_PRIORITY[entry.level] >= LEVEL_PRIORITY[level];
}

export const log = {
  debug(context: string, message: string, data?: Record<string, unknown>): void {
    write("debug", context, message, undefined, data);
  },
  info(context: string, message: string, data?: Record<string, unknown>): void {
    write("info", context, message, undefined, data);
  },
  warn(
    context: string,
    message: string,
    error?: unknown,
    data?: Record<string, unknown>,
  ): void {
    write("warn", context, message, error, data);
  },
  error(
    context: string,
    message: string,
    error?: unknown,
    data?: Record<string, unknown>,
  ): void {
    write("error", context, message, error, data);
  },
};
