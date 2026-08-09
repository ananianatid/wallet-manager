import {
  addLogSink,
  clearLogs,
  getRecentLogs,
  getRingBuffer,
  log,
  logLevelAtLeast,
  type LogEntry,
} from "./logger";

describe("logger", () => {
  beforeEach(() => {
    clearLogs();
  });

  it("émet les entrées vers les sinks enregistrés", () => {
    const received: LogEntry[] = [];
    addLogSink((entry) => received.push(entry));
    log.info("test", "message de test");
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      level: "info",
      context: "test",
      message: "message de test",
    });
    expect(typeof received[0].ts).toBe("string");
  });

  it("addLogSink renvoie une fonction de désinscription", () => {
    const received: LogEntry[] = [];
    const unsubscribe = addLogSink((entry) => received.push(entry));
    unsubscribe();
    log.info("test", "après désinscription");
    expect(received).toHaveLength(0);
  });

  it("serialise un Error avec nom, message et pile", () => {
    const received: LogEntry[] = [];
    addLogSink((entry) => received.push(entry));
    const cause = new Error("boom");
    cause.name = "BoomError";
    log.error("test", "échec", cause);
    expect(received[0].error).toMatchObject({
      name: "BoomError",
      message: "boom",
    });
    expect(typeof received[0].error?.stack).toBe("string");
  });

  it("serialise une erreur de type chaîne", () => {
    const received: LogEntry[] = [];
    addLogSink((entry) => received.push(entry));
    log.warn("test", "avertissement", "string error");
    expect(received[0].error).toEqual({ name: "Error", message: "string error" });
  });

  it("serialise une valeur inconnue sans casser", () => {
    const received: LogEntry[] = [];
    addLogSink((entry) => received.push(entry));
    log.warn("test", "inconnu", { weird: true });
    expect(received[0].error).toMatchObject({ name: "UnknownError" });
  });

  it("conserve une erreur sans erreur fournie", () => {
    const received: LogEntry[] = [];
    addLogSink((entry) => received.push(entry));
    log.info("test", "info sans erreur");
    expect(received[0].error).toBeUndefined();
  });

  it("sauvegarde les données structurées", () => {
    const received: LogEntry[] = [];
    addLogSink((entry) => received.push(entry));
    log.info("test", "avec données", { count: 3 });
    expect(received[0].data).toEqual({ count: 3 });
  });

  it("limite le ring buffer à 200 entrées", () => {
    for (let i = 0; i < 250; i++) {
      log.info("test", `entrée ${i}`);
    }
    expect(getRingBuffer()).toHaveLength(200);
    expect(getRecentLogs(5)).toHaveLength(5);
    expect(getRecentLogs(5)[0].message).toBe("entrée 245");
  });

  it("fournit un sessionId stable", () => {
    const a = log.info.bind(log, "test", "a");
    const b = log.info.bind(log, "test", "b");
    a();
    b();
    const [first, second] = getRecentLogs(2);
    expect(first.sessionId).toBe(second.sessionId);
    expect(first.sessionId.length).toBeGreaterThan(0);
  });

  it("logLevelAtLeast compare les priorités", () => {
    const error = { level: "error" } as LogEntry;
    const warn = { level: "warn" } as LogEntry;
    const debug = { level: "debug" } as LogEntry;
    expect(logLevelAtLeast(error, "warn")).toBe(true);
    expect(logLevelAtLeast(warn, "warn")).toBe(true);
    expect(logLevelAtLeast(warn, "error")).toBe(false);
    expect(logLevelAtLeast(debug, "error")).toBe(false);
  });

  it("un sink qui échoue ne bloque pas les autres", () => {
    const received: LogEntry[] = [];
    addLogSink(() => {
      throw new Error("sink cassé");
    });
    addLogSink((entry) => received.push(entry));
    expect(() => log.info("test", "résilience")).not.toThrow();
    expect(received).toHaveLength(1);
  });

  it("préserve les logs entre les écritures (persistance mémoire)", () => {
    log.info("test", "un");
    log.info("test", "deux");
    expect(getRecentLogs()).toHaveLength(2);
  });
});
