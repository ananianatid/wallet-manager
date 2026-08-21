import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "./auth.js";
import { query, withTransaction } from "./db.js";

const entityType = z.string().regex(/^[a-z_]+$/).max(80);

/**
 * Read-only cloud bootstrap for the browser.
 *
 * The browser never receives database credentials and never executes SQL.
 * Android continues to use /api/sync for its local-first workflow.
 */
export async function registerCloudDataRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/cloud/bootstrap", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (!user.emailVerified) {
      return reply.code(403).send({
        code: "EMAIL_NOT_VERIFIED",
        message: "Vérifiez votre adresse email avant d’ouvrir vos données cloud.",
      });
    }

    const queryParams = z.object({
      entityTypes: z.string().optional(),
    }).parse(request.query);
    const requestedTypes = queryParams.entityTypes
      ?.split(",")
      .map((value) => entityType.parse(value.trim()))
      .filter(Boolean);

    const result = await query<{
      entity_type: string;
      entity_id: string;
      version: number;
      payload: Record<string, unknown>;
      deleted_at: Date | null;
      updated_at: Date;
    }>(
      `SELECT entity_type, entity_id, version, payload, deleted_at, updated_at
       FROM sync_entities
       WHERE workspace_id = $1
         AND ($2::text[] IS NULL OR entity_type = ANY($2::text[]))
       ORDER BY entity_type ASC, updated_at ASC, entity_id ASC`,
      [user.workspaceId, requestedTypes?.length ? requestedTypes : null],
    );

    return reply.send({
      workspaceId: user.workspaceId,
      entities: result.rows.map((row) => ({
        entityType: row.entity_type,
        entityId: row.entity_id,
        version: row.version,
        payload: row.deleted_at ? null : row.payload,
        deletedAt: row.deleted_at,
        updatedAt: row.updated_at,
      })),
    });
  });

  app.put("/api/cloud/entities/:entityType/:entityId", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (!user.emailVerified) return reply.code(403).send({ code: "EMAIL_NOT_VERIFIED", message: "Vérifiez votre adresse email avant de modifier vos données cloud." });

    const params = z.object({ entityType, entityId: z.string().uuid() }).parse(request.params);
    const body = z.object({
      baseVersion: z.number().int().nonnegative().default(0),
      payload: z.record(z.string(), z.unknown()),
    }).parse(request.body);

    const result = await withTransaction(async (client) => {
      const current = await client.query<{ version: number; payload: unknown; deleted_at: Date | null }>(
        `SELECT version, payload, deleted_at FROM sync_entities
         WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3 FOR UPDATE`,
        [user.workspaceId, params.entityType, params.entityId],
      );
      const row = current.rows[0];
      const currentVersion = row?.version ?? 0;
      if (currentVersion !== body.baseVersion) {
        return { conflict: { entityType: params.entityType, entityId: params.entityId, version: currentVersion, payload: row?.deleted_at ? null : row?.payload ?? null } };
      }
      const nextVersion = currentVersion + 1;
      await client.query(
        `INSERT INTO sync_entities (workspace_id, entity_type, entity_id, version, payload, deleted_at)
         VALUES ($1, $2, $3, $4, $5, NULL)
         ON CONFLICT (workspace_id, entity_type, entity_id) DO UPDATE SET
           version = EXCLUDED.version, payload = EXCLUDED.payload, updated_at = now(), deleted_at = NULL`,
        [user.workspaceId, params.entityType, params.entityId, nextVersion, body.payload],
      );
      await client.query(
        `INSERT INTO sync_changes (workspace_id, entity_type, entity_id, version, operation, payload)
         VALUES ($1, $2, $3, $4, 'upsert', $5)`,
        [user.workspaceId, params.entityType, params.entityId, nextVersion, body.payload],
      );
      await client.query(
        `INSERT INTO audit_events (workspace_id, user_id, entity_type, entity_id, operation, before_payload, after_payload)
         VALUES ($1, $2, $3, $4, 'upsert', $5, $6)`,
        [user.workspaceId, user.id, params.entityType, params.entityId, row?.payload ?? null, body.payload],
      );
      return { entityType: params.entityType, entityId: params.entityId, version: nextVersion, payload: body.payload };
    });

    if ("conflict" in result) return reply.code(409).send({ code: "SYNC_CONFLICT", ...result.conflict });
    return reply.code(200).send(result);
  });

  app.delete("/api/cloud/entities/:entityType/:entityId", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (!user.emailVerified) return reply.code(403).send({ code: "EMAIL_NOT_VERIFIED", message: "Vérifiez votre adresse email avant de modifier vos données cloud." });
    const params = z.object({ entityType, entityId: z.string().uuid() }).parse(request.params);
    const body = z.object({ baseVersion: z.number().int().nonnegative() }).parse(request.body ?? {});
    const result = await withTransaction(async (client) => {
      const current = await client.query<{ version: number; payload: unknown }>(
        `SELECT version, payload FROM sync_entities WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3 AND deleted_at IS NULL FOR UPDATE`,
        [user.workspaceId, params.entityType, params.entityId],
      );
      const row = current.rows[0];
      if (!row) return { missing: true } as const;
      if (row.version !== body.baseVersion) return { conflict: { entityType: params.entityType, entityId: params.entityId, version: row.version, payload: row.payload } } as const;
      const nextVersion = row.version + 1;
      await client.query(`UPDATE sync_entities SET version = $1, deleted_at = now(), updated_at = now() WHERE workspace_id = $2 AND entity_type = $3 AND entity_id = $4`, [nextVersion, user.workspaceId, params.entityType, params.entityId]);
      await client.query(`INSERT INTO sync_changes (workspace_id, entity_type, entity_id, version, operation, payload) VALUES ($1, $2, $3, $4, 'delete', NULL)`, [user.workspaceId, params.entityType, params.entityId, nextVersion]);
      await client.query(`INSERT INTO audit_events (workspace_id, user_id, entity_type, entity_id, operation, before_payload, after_payload) VALUES ($1, $2, $3, $4, 'delete', $5, NULL)`, [user.workspaceId, user.id, params.entityType, params.entityId, row.payload]);
      return { deleted: true } as const;
    });
    if ("missing" in result) return reply.code(404).send({ code: "ENTITY_NOT_FOUND" });
    if ("conflict" in result) return reply.code(409).send({ code: "SYNC_CONFLICT", ...result.conflict });
    return reply.code(204).send();
  });
}
