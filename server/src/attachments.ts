import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authenticate } from "./auth.js";
import { query } from "./db.js";
import { getAttachmentUrl, putAttachment, removeAttachment } from "./storage.js";

const fieldValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value && typeof value.value === "string") return value.value;
  throw new Error("Champ multipart invalide.");
};

export async function registerAttachmentRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/attachments", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const part = await request.file();
    if (!part) return reply.code(400).send({ code: "FILE_REQUIRED", message: "Un fichier est requis." });
    const entityType = z.string().regex(/^[a-z_]+$/).max(80).parse(fieldValue(part.fields.entityType));
    const entityId = z.string().uuid().parse(fieldValue(part.fields.entityId));
    const originalName = fieldValue(part.fields.originalName ?? part.filename).slice(0, 240);
    const mimeType = z.string().max(160).parse(fieldValue(part.fields.mimeType ?? part.mimetype));
    const chunks: Buffer[] = [];
    for await (const chunk of part.file) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const content = Buffer.concat(chunks);
    if (part.file.truncated || content.byteLength > 10 * 1024 * 1024) {
      return reply.code(413).send({ code: "FILE_TOO_LARGE", message: "La pièce jointe dépasse 10 Mo." });
    }
    const objectKey = `${user.workspaceId}/${entityType}/${entityId}/${randomUUID()}-${originalName.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
    await putAttachment(objectKey, content, mimeType);
    try {
      const result = await query<{ id: string }>(
        `INSERT INTO attachments (workspace_id, entity_type, entity_id, object_key, original_name, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [user.workspaceId, entityType, entityId, objectKey, originalName, mimeType, content.byteLength],
      );
      return reply.code(201).send({ id: result.rows[0].id, entityType, entityId, originalName, mimeType, sizeBytes: content.byteLength, url: await getAttachmentUrl(objectKey) });
    } catch (error) {
      await removeAttachment(objectKey).catch(() => undefined);
      throw error;
    }
  });

  app.get("/api/attachments/:id", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const id = z.object({ id: z.string().uuid() }).parse(request.params).id;
    const result = await query<{ object_key: string }>("SELECT object_key FROM attachments WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL", [id, user.workspaceId]);
    if (!result.rows[0]) return reply.code(404).send({ code: "ATTACHMENT_NOT_FOUND" });
    return reply.redirect(await getAttachmentUrl(result.rows[0].object_key));
  });

  app.delete("/api/attachments/:id", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const id = z.object({ id: z.string().uuid() }).parse(request.params).id;
    const result = await query<{ object_key: string }>("UPDATE attachments SET deleted_at = now() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL RETURNING object_key", [id, user.workspaceId]);
    if (result.rows[0]) await removeAttachment(result.rows[0].object_key).catch(() => undefined);
    return reply.code(204).send();
  });
}
