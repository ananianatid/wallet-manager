import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "./auth.js";
import { query, withTransaction } from "./db.js";

const entityType = z.string().regex(/^[a-z_]+$/).max(80);
const changeSchema = z.object({
  clientChangeId: z.number().int().positive(),
  entityType,
  entityId: z.string().uuid(),
  version: z.number().int().positive(),
  baseVersion: z.number().int().nonnegative().nullable().default(null),
  operation: z.enum(["upsert", "delete"]),
  payload: z.record(z.string(), z.unknown()).nullable().default(null),
  deviceId: z.string().uuid().nullable().default(null),
});

export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/sync/push", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (!user.emailVerified) return reply.code(403).send({ code: "EMAIL_NOT_VERIFIED", message: "Vérifiez votre adresse email avant de synchroniser." });
    const body = z.object({ changes: z.array(changeSchema).min(1).max(500) }).parse(request.body);
    const conflicts: Array<{ entityType: string; entityId: string; serverVersion: number; serverPayload: unknown; serverOperation: "upsert" | "delete" }> = [];
    const accepted: number[] = [];

    await withTransaction(async (client) => {
      for (const change of body.changes) {
        const current = await client.query<{ version: number; payload: unknown; deleted_at: Date | null }>(
          `SELECT version, payload, deleted_at FROM sync_entities
           WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3
           FOR UPDATE`,
          [user.workspaceId, change.entityType, change.entityId],
        );
        const row = current.rows[0];
        const baseVersionMissing = !row && change.baseVersion !== null && change.baseVersion !== 0;
        if ((row && change.baseVersion !== row.version) || baseVersionMissing) {
          conflicts.push({
            entityType: change.entityType,
            entityId: change.entityId,
            serverVersion: row?.version ?? 0,
            serverPayload: row?.payload ?? null,
            serverOperation: row?.deleted_at ? "delete" : "upsert",
          });
          continue;
        }
        const nextVersion = row ? row.version + 1 : 1;
        await client.query(
          `INSERT INTO sync_entities (workspace_id, entity_type, entity_id, version, payload, deleted_at)
           VALUES ($1, $2, $3, $4, $5, CASE WHEN $6 = 'delete' THEN now() ELSE NULL END)
           ON CONFLICT (workspace_id, entity_type, entity_id) DO UPDATE SET
             version = EXCLUDED.version, payload = EXCLUDED.payload,
             updated_at = now(), deleted_at = EXCLUDED.deleted_at`,
          [user.workspaceId, change.entityType, change.entityId, nextVersion, change.payload ?? {}, change.operation],
        );
        await client.query(
          `INSERT INTO sync_changes (workspace_id, entity_type, entity_id, version, operation, payload, device_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [user.workspaceId, change.entityType, change.entityId, nextVersion, change.operation, change.payload, change.deviceId],
        );
        await client.query(
          `INSERT INTO audit_events (workspace_id, user_id, device_id, entity_type, entity_id, operation, after_payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [user.workspaceId, user.id, change.deviceId, change.entityType, change.entityId, change.operation, change.payload],
        );
        accepted.push(change.clientChangeId);
      }
    });
    return reply.send({ accepted, conflicts });
  });

  app.get("/api/sync/pull", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (!user.emailVerified) return reply.code(403).send({ code: "EMAIL_NOT_VERIFIED", message: "Vérifiez votre adresse email avant de synchroniser." });
    const params = z.object({ since: z.coerce.number().int().nonnegative().default(0), limit: z.coerce.number().int().min(1).max(500).default(200) }).parse(request.query);
    const result = await query<{
      sequence: string;
      entity_type: string;
      entity_id: string;
      version: number;
      operation: "upsert" | "delete";
      payload: unknown;
      created_at: Date;
    }>(
      `SELECT sequence, entity_type, entity_id, version, operation, payload, created_at
       FROM sync_changes WHERE workspace_id = $1 AND sequence > $2
       ORDER BY sequence ASC LIMIT $3`,
      [user.workspaceId, params.since, params.limit],
    );
    const changes = result.rows.map((row) => ({
      sequence: Number(row.sequence),
      entityType: row.entity_type,
      entityId: row.entity_id,
      version: row.version,
      operation: row.operation,
      payload: row.payload,
      createdAt: row.created_at,
    }));
    return reply.send({ changes, nextCursor: changes.at(-1)?.sequence ?? params.since });
  });
}
