import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { pool } from "./db.js";
import { migrate } from "./migrate.js";
import { registerAuthRoutes } from "./auth.js";
import { registerSyncRoutes } from "./sync.js";
import multipart from "@fastify/multipart";
import { registerAttachmentRoutes } from "./attachments.js";
import { ensureStorageBucket } from "./storage.js";
import { registerCloudDataRoutes } from "./cloud-data.js";
import { ZodError } from "zod";

const app = Fastify({ logger: config.NODE_ENV !== "test" });

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    request.log.warn({ issues: error.issues.map(({ code, path, message }) => ({ code, path, message })) }, "Invalid request payload");
    return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Les données envoyées sont invalides." });
  }
  const httpError = error as { statusCode?: number; code?: string };
  if (httpError.statusCode && httpError.statusCode >= 400 && httpError.statusCode < 500) {
    return reply.code(httpError.statusCode).send({ code: httpError.code ?? "REQUEST_ERROR", message: "La requête envoyée est invalide." });
  }
  request.log.error({ err: error }, "Unhandled request error");
  return reply.code(500).send({ code: "INTERNAL_ERROR", message: "Une erreur interne est survenue." });
});

await app.register(cookie);
await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
await app.register(rateLimit, { global: true, max: 120, timeWindow: "1 minute" });

await migrate();
await ensureStorageBucket();

app.get("/api/healthz", async (_request, reply) => {
  try {
    await pool.query("SELECT 1");
    return reply.send({ ok: true });
  } catch {
    return reply.code(503).send({ ok: false });
  }
});

app.get("/api/readyz", async (_request, reply) => {
  try {
    await pool.query("SELECT 1 FROM schema_migrations LIMIT 1");
    return reply.send({ ok: true });
  } catch {
    return reply.code(503).send({ ok: false });
  }
});

await registerAuthRoutes(app);
await registerSyncRoutes(app);
await registerCloudDataRoutes(app);
await registerAttachmentRoutes(app);

await app.listen({ host: config.HOST, port: config.PORT });

const shutdown = async () => {
  await app.close();
  await pool.end();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
