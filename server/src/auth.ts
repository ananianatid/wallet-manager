import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { createOpaqueToken, hashOpaqueToken, hashPassword, verifyPassword } from "./crypto.js";
import { query, withTransaction } from "./db.js";
import type { PoolClient } from "pg";
import { sendAccountEmail } from "./mail.js";

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(8).max(256);

const refreshCookie = "wallet_refresh";

const DEFAULT_CLOUD_CATEGORIES = [
  ["account", "Compte courant", "wallet-cards"],
  ["account", "Épargne", "piggy-bank"],
  ["account", "Espèces", "banknote"],
  ["account", "Mobile Money", "smartphone"],
  ["account", "Autre", "tag"],
  ["income", "Salaire", "banknote-arrow-up"],
  ["income", "Virement reçu", "banknote"],
  ["income", "Cadeau", "gift"],
  ["income", "Remboursement", "rotate-ccw"],
  ["income", "Autre", "tag"],
  ["expense", "Nourriture", "utensils"],
  ["expense", "Transport", "car-front"],
  ["expense", "Logement", "house"],
  ["expense", "Factures", "receipt-text"],
  ["expense", "Santé", "heart-pulse"],
  ["expense", "Éducation", "graduation-cap"],
  ["expense", "Loisirs", "gamepad-2"],
  ["expense", "Shopping", "shopping-bag"],
  ["expense", "Autre", "tag"],
] as const;

function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(refreshCookie, token, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: "lax",
    path: "/api/auth",
    expires: expiresAt,
  });
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(refreshCookie, { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: "lax", path: "/api/auth" });
}

async function issueSession(userId: string, deviceName: string, reply: FastifyReply, client: "web" | "mobile"): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const refreshToken = createOpaqueToken();
  const refreshHash = hashOpaqueToken(refreshToken);
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await query(
    `INSERT INTO sessions (user_id, token_hash, device_name, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, refreshHash, deviceName.slice(0, 120) || "Appareil inconnu", expiresAt],
  );
  setRefreshCookie(reply, refreshToken, expiresAt);
  const accessToken = createOpaqueToken();
  const accessHash = hashOpaqueToken(accessToken);
  await query(
    `INSERT INTO access_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
    [userId, accessHash, config.ACCESS_TOKEN_TTL_SECONDS],
  );
  return { accessToken, expiresIn: config.ACCESS_TOKEN_TTL_SECONDS, ...(client === "mobile" ? { refreshToken } : {}) };
}

async function sendVerificationEmail(userId: string, email: string, client?: PoolClient): Promise<void> {
  const token = createOpaqueToken();
  const execute = client ? client.query.bind(client) : query;
  await execute(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '24 hours')`,
    [userId, hashOpaqueToken(token)],
  );
  const url = `${config.PUBLIC_API_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  await sendAccountEmail({
    to: email,
    subject: "Vérifiez votre adresse email — Wallet Manager",
    text: `Vérifiez votre adresse email avec ce lien : ${url}`,
    html: `<p>Vérifiez votre adresse email pour activer la synchronisation Wallet.</p><p><a href="${url}">Vérifier mon adresse email</a></p>`,
  });
}

async function sendPasswordResetEmail(userId: string, email: string): Promise<void> {
  const token = createOpaqueToken();
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '1 hour')`,
    [userId, hashOpaqueToken(token)],
  );
  const url = `${config.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
  await sendAccountEmail({
    to: email,
    subject: "Réinitialiser votre mot de passe — Wallet Manager",
    text: `Réinitialisez votre mot de passe avec ce lien : ${url}`,
    html: `<p>Ce lien de réinitialisation est valable une heure.</p><p><a href="${url}">Réinitialiser mon mot de passe</a></p>`,
  });
}

async function sendAccountRecoveryEmail(email: string, token: string): Promise<void> {
  const url = `${config.WEB_ORIGIN}/recover-account?token=${encodeURIComponent(token)}`;
  await sendAccountEmail({
    to: email,
    subject: "Récupérer votre compte Wallet Manager",
    text: `Votre compte sera supprimé dans 30 jours. Pour annuler cette demande : ${url}`,
    html: `<p>Votre compte est programmé pour suppression dans 30 jours.</p><p><a href="${url}">Annuler la suppression du compte</a></p>`,
  });
}

export async function authenticate(request: FastifyRequest): Promise<{ id: string; email: string; emailVerified: boolean; workspaceId: string } | null> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const tokenHash = hashOpaqueToken(header.slice("Bearer ".length));
  const result = await query<{ id: string; email: string; email_verified_at: Date | null; workspace_id: string }>(
    `SELECT u.id, u.email, u.email_verified_at, wm.workspace_id
     FROM access_tokens a JOIN users u ON u.id = a.user_id
     JOIN workspace_members wm ON wm.user_id = u.id
     WHERE a.token_hash = $1 AND a.revoked_at IS NULL AND a.expires_at > now() AND u.deleted_at IS NULL`,
    [tokenHash],
  );
  const user = result.rows[0];
  return user ? { id: user.id, email: user.email, emailVerified: Boolean(user.email_verified_at), workspaceId: user.workspace_id } : null;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/register", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const body = z.object({ email: emailSchema, password: passwordSchema, deviceName: z.string().max(120).default("Appareil inconnu"), client: z.enum(["web", "mobile"]).default("mobile") }).parse(request.body);
    const passwordHash = await hashPassword(body.password);
    try {
      const result = await withTransaction(async (client) => {
        const user = await client.query<{ id: string }>(
          `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
          [body.email, passwordHash],
        );
        const workspace = await client.query<{ id: string }>(
          `INSERT INTO workspaces (owner_id, name) VALUES ($1, 'Portefeuille personnel') RETURNING id`,
          [user.rows[0].id],
        );
        await client.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`, [workspace.rows[0].id, user.rows[0].id]);
        for (const [type, name, icon] of DEFAULT_CLOUD_CATEGORIES) {
          const category = await client.query<{ entity_id: string }>(
            `INSERT INTO sync_entities (workspace_id, entity_type, entity_id, version, payload)
             VALUES ($1, 'categories', gen_random_uuid(), 1, $2::jsonb) RETURNING entity_id`,
            [workspace.rows[0].id, JSON.stringify({ fields: { type, name, is_seed: 1, icon }, refs: {} })],
          );
          await client.query(
            `INSERT INTO sync_changes (workspace_id, entity_type, entity_id, version, operation, payload)
             VALUES ($1, 'categories', $2, 1, 'upsert', $3::jsonb)`,
            [workspace.rows[0].id, category.rows[0].entity_id, JSON.stringify({ fields: { type, name, is_seed: 1, icon }, refs: {} })],
          );
        }
        if (config.EMAIL_VERIFICATION_REQUIRED) {
          await sendVerificationEmail(user.rows[0].id, body.email, client);
        } else {
          await client.query("UPDATE users SET email_verified_at = now(), updated_at = now() WHERE id = $1", [user.rows[0].id]);
        }
        return user.rows[0].id;
      });
      const session = await issueSession(result, body.deviceName, reply, body.client);
      return reply.code(201).send({ ...session, emailVerified: !config.EMAIL_VERIFICATION_REQUIRED });
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        return reply.code(409).send({ code: "EMAIL_ALREADY_USED", message: "Cette adresse email est déjà utilisée." });
      }
      request.log.error({ err: error }, "Unable to register account");
      return reply.code(503).send({ code: "EMAIL_DELIVERY_FAILED", message: "Impossible d’envoyer l’email de vérification. Réessayez plus tard." });
    }
  });

  app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const body = z.object({ email: emailSchema, password: z.string().max(256), deviceName: z.string().max(120).default("Appareil inconnu"), client: z.enum(["web", "mobile"]).default("mobile") }).parse(request.body);
    const result = await query<{ id: string; email: string; password_hash: string; email_verified_at: Date | null }>(
      "SELECT id, email, password_hash, email_verified_at FROM users WHERE email = $1 AND deleted_at IS NULL",
      [body.email],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(user.password_hash, body.password))) {
      return reply.code(401).send({ code: "INVALID_CREDENTIALS", message: "Email ou mot de passe incorrect." });
    }
    const session = await issueSession(user.id, body.deviceName, reply, body.client);
    return reply.send({ ...session, emailVerified: Boolean(user.email_verified_at) });
  });

  app.post("/api/auth/refresh", async (request, reply) => {
    const body = z.object({ refreshToken: z.string().min(20).optional() }).parse(request.body ?? {});
    const token = request.cookies[refreshCookie] ?? body.refreshToken;
    if (!token) return reply.code(401).send({ code: "SESSION_REQUIRED" });
    const result = await query<{ id: string; user_id: string; device_name: string }>(
      `SELECT id, user_id, device_name FROM sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [hashOpaqueToken(token)],
    );
    const session = result.rows[0];
    if (!session) {
      clearRefreshCookie(reply);
      return reply.code(401).send({ code: "SESSION_EXPIRED" });
    }
    await query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [session.id]);
    const next = await issueSession(session.user_id, session.device_name, reply, body.refreshToken ? "mobile" : "web");
    return reply.send(next);
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const body = z.object({ refreshToken: z.string().min(20).optional() }).parse(request.body ?? {});
    const token = request.cookies[refreshCookie] ?? body.refreshToken;
    if (token) await query("UPDATE sessions SET revoked_at = now() WHERE token_hash = $1", [hashOpaqueToken(token)]);
    clearRefreshCookie(reply);
    return reply.code(204).send();
  });

  app.post("/api/auth/forgot-password", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const body = z.object({ email: emailSchema }).parse(request.body);
    const result = await query<{ id: string; email: string }>(
      "SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL",
      [body.email],
    );
    if (result.rows[0]) {
      await sendPasswordResetEmail(result.rows[0].id, result.rows[0].email);
    }
    return reply.send({ message: "Si cette adresse existe, un email de réinitialisation a été envoyé." });
  });

  app.post("/api/auth/resend-verification", { config: { rateLimit: { max: 3, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    if (!user.emailVerified) {
      await sendVerificationEmail(user.id, user.email);
    }
    return reply.send({ message: "Si votre adresse n’est pas encore vérifiée, un nouvel email a été envoyé." });
  });

  app.get("/api/auth/sessions", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const result = await query<{ id: string; device_name: string; created_at: Date; last_seen_at: Date; expires_at: Date }>(
      `SELECT id, device_name, created_at, last_seen_at, expires_at
       FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
       ORDER BY last_seen_at DESC`,
      [user.id],
    );
    return reply.send({ sessions: result.rows.map((session) => ({ id: session.id, deviceName: session.device_name, createdAt: session.created_at, lastSeenAt: session.last_seen_at, expiresAt: session.expires_at })) });
  });

  app.delete("/api/auth/sessions/:id", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    await query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2", [params.id, user.id]);
    return reply.code(204).send();
  });

  app.post("/api/auth/delete-account", { config: { rateLimit: { max: 3, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    const body = z.object({ password: z.string().max(256) }).parse(request.body);
    const result = await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL", [user.id]);
    if (!result.rows[0] || !(await verifyPassword(result.rows[0].password_hash, body.password))) {
      return reply.code(401).send({ code: "INVALID_CREDENTIALS", message: "Mot de passe incorrect." });
    }
    const recoveryToken = createOpaqueToken();
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO account_recovery_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [user.id, hashOpaqueToken(recoveryToken)],
      );
      await client.query("UPDATE users SET deleted_at = now(), updated_at = now() WHERE id = $1", [user.id]);
      await client.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [user.id]);
      await client.query("UPDATE access_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [user.id]);
    });
    await sendAccountRecoveryEmail(user.email, recoveryToken);
    clearRefreshCookie(reply);
    return reply.send({ message: "Compte programmé pour suppression. Vous avez 30 jours pour annuler." });
  });

  app.post("/api/auth/recover-account", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const body = z.object({ token: z.string().min(20) }).parse(request.body);
    const tokenHash = hashOpaqueToken(body.token);
    const result = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM account_recovery_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    const recovery = result.rows[0];
    if (!recovery) return reply.code(400).send({ code: "RECOVERY_TOKEN_INVALID", message: "Ce lien de récupération est invalide ou expiré." });
    await withTransaction(async (client) => {
      await client.query("UPDATE users SET deleted_at = NULL, updated_at = now() WHERE id = $1", [recovery.user_id]);
      await client.query("UPDATE account_recovery_tokens SET used_at = now() WHERE id = $1", [recovery.id]);
    });
    return reply.send({ message: "Compte récupéré. Vous pouvez vous reconnecter." });
  });

  app.post("/api/auth/reset-password", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const body = z.object({ token: z.string().min(20), password: passwordSchema }).parse(request.body);
    const tokenHash = hashOpaqueToken(body.token);
    const result = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    const reset = result.rows[0];
    if (!reset) return reply.code(400).send({ code: "RESET_TOKEN_INVALID", message: "Ce lien est invalide ou expiré." });
    const passwordHash = await hashPassword(body.password);
    await withTransaction(async (client) => {
      await client.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [passwordHash, reset.user_id]);
      await client.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [reset.id]);
      await client.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [reset.user_id]);
      await client.query("UPDATE access_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [reset.user_id]);
    });
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", async (request, reply) => {
    const user = await authenticate(request);
    if (!user) return reply.code(401).send({ code: "AUTH_REQUIRED" });
    return reply.send(user);
  });

  app.get("/api/auth/verify-email", async (request, reply) => {
    const queryParams = z.object({ token: z.string().min(20) }).parse(request.query);
    const result = await query<{ user_id: string }>(
      `SELECT user_id FROM email_verification_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [hashOpaqueToken(queryParams.token)],
    );
    const token = result.rows[0];
    if (!token) return reply.code(400).type("text/plain").send("Lien de vérification invalide ou expiré.");
    await withTransaction(async (client) => {
      await client.query("UPDATE users SET email_verified_at = now() WHERE id = $1", [token.user_id]);
      await client.query("UPDATE email_verification_tokens SET used_at = now() WHERE token_hash = $1", [hashOpaqueToken(queryParams.token)]);
    });
    return reply.type("text/plain").send("Adresse vérifiée. Vous pouvez revenir dans Wallet.");
  });
}
