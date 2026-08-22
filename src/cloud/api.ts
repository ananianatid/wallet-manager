import { Platform } from "react-native";
import { File } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import type {
  CloudAttachment,
  CloudBootstrap,
  CloudEntity,
  CloudSession,
  CloudUser,
  SyncChange,
  SyncConflict,
} from "./types";
import { fetchHttpAdapter, type CloudHttpAdapter } from "./http";
export type {
  CloudAttachment,
  CloudBootstrap,
  CloudEntity,
  CloudSession,
  CloudUser,
  SyncChange,
  SyncConflict,
} from "./types";

const configuredApiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const API_BASE = Platform.OS === "web"
  ? (configuredApiBase || "/api")
  : configuredApiBase && /^https?:\/\//i.test(configuredApiBase)
    ? configuredApiBase
    : "";
const REFRESH_TOKEN_KEY = "wallet.refresh-token";
const WEB_SESSION_HINT_KEY = "wallet.web-session-present";

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let httpAdapter: CloudHttpAdapter = fetchHttpAdapter;

export function setCloudHttpAdapter(adapter: CloudHttpAdapter): () => void {
  const previous = httpAdapter;
  httpAdapter = adapter;
  return () => {
    httpAdapter = previous;
  };
}

interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  emailVerified?: boolean;
}

async function readRefreshToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined" || localStorage.getItem(WEB_SESSION_HINT_KEY) !== "1") return null;
    return null;
  }
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

async function writeRefreshToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined") return;
    if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!API_BASE) throw new Error("Le serveur cloud n’est pas configuré pour cette version de Wallet.");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await httpAdapter.request(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && retry && path !== "/auth/refresh") {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, init, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; code?: string } | null;
    const error = new Error(body?.message ?? "La requête cloud a échoué.");
    Object.assign(error, { code: body?.code, status: response.status });
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function saveSession(session: SessionResponse): Promise<void> {
  accessToken = session.accessToken;
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem(WEB_SESSION_HINT_KEY, "1");
  }
  if (session.refreshToken) await writeRefreshToken(session.refreshToken);
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = await readRefreshToken();
      const session = await request<SessionResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      }, false);
      await saveSession(session);
      return session.accessToken;
    } catch {
      accessToken = null;
      if (Platform.OS === "web" && typeof localStorage !== "undefined") localStorage.removeItem(WEB_SESSION_HINT_KEY);
      await writeRefreshToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function restoreCloudSession(): Promise<CloudUser | null> {
  if (!(await refreshAccessToken())) return null;
  return request<CloudUser>("/auth/me");
}

export async function registerCloudAccount(input: { email: string; password: string; deviceName: string }): Promise<CloudUser> {
  const session = await request<SessionResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...input, client: Platform.OS === "web" ? "web" : "mobile" }),
  }, false);
  await saveSession(session);
  return { ...(await request<CloudUser>("/auth/me")), emailVerified: Boolean(session.emailVerified) };
}

export async function loginCloudAccount(input: { email: string; password: string; deviceName: string }): Promise<CloudUser> {
  const session = await request<SessionResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ ...input, client: Platform.OS === "web" ? "web" : "mobile" }),
  }, false);
  await saveSession(session);
  return { ...(await request<CloudUser>("/auth/me")), emailVerified: Boolean(session.emailVerified) };
}

export async function logoutCloudAccount(): Promise<void> {
  try {
    const refreshToken = Platform.OS === "web" ? null : await readRefreshToken();
    await request<void>("/auth/logout", { method: "POST", body: JSON.stringify(refreshToken ? { refreshToken } : {}) }, false);
  } finally {
    accessToken = null;
    if (Platform.OS === "web" && typeof localStorage !== "undefined") localStorage.removeItem(WEB_SESSION_HINT_KEY);
    await writeRefreshToken(null);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }, false);
}

export async function resendVerificationEmail(): Promise<void> {
  await request("/auth/resend-verification", { method: "POST" });
}

export async function listCloudSessions(): Promise<CloudSession[]> {
  const result = await request<{ sessions: CloudSession[] }>("/auth/sessions");
  return result.sessions;
}

export async function revokeCloudSession(id: string): Promise<void> {
  await request<void>(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function deleteCloudAccount(password: string): Promise<void> {
  await request("/auth/delete-account", { method: "POST", body: JSON.stringify({ password }) });
  accessToken = null;
  await writeRefreshToken(null);
}

export async function recoverCloudAccount(token: string): Promise<void> {
  await request("/auth/recover-account", { method: "POST", body: JSON.stringify({ token }) }, false);
}

export async function uploadCloudAttachment(input: { entityType: string; entityId: string; uri: string; originalName: string; mimeType: string }): Promise<CloudAttachment> {
  const file = new File(input.uri);
  if (!file.exists) throw new Error("La pièce jointe locale n’existe plus.");
  const form = new FormData();
  form.append("entityType", input.entityType);
  form.append("entityId", input.entityId);
  form.append("originalName", input.originalName);
  form.append("mimeType", input.mimeType);
  // Expo SDK 57 expose File comme Blob multipart sur mobile et sur le web.
  form.append("file", file as unknown as Blob);
  return request<CloudAttachment>("/attachments", { method: "POST", body: form });
}

export async function refreshCloudUser(): Promise<CloudUser> {
  return request<CloudUser>("/auth/me");
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await request("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }, false);
}

export async function pushSyncChanges(changes: SyncChange[]): Promise<{ accepted: number[]; conflicts: SyncConflict[] }> {
  return request("/sync/push", { method: "POST", body: JSON.stringify({ changes }) });
}

export async function pullSyncChanges(since: number, limit = 200): Promise<{ changes: SyncChange[]; nextCursor: number }> {
  return request(`/sync/pull?since=${encodeURIComponent(since)}&limit=${encodeURIComponent(limit)}`);
}

export async function loadCloudBootstrap(entityTypes?: string[]): Promise<CloudBootstrap> {
  const query = entityTypes?.length ? `?entityTypes=${encodeURIComponent(entityTypes.join(","))}` : "";
  return request<CloudBootstrap>(`/cloud/bootstrap${query}`);
}

export async function upsertCloudEntity(input: {
  entityType: string;
  entityId: string;
  baseVersion: number;
  payload: Record<string, unknown>;
}): Promise<CloudEntity> {
  return request<CloudEntity>(`/cloud/entities/${encodeURIComponent(input.entityType)}/${encodeURIComponent(input.entityId)}`, {
    method: "PUT",
    body: JSON.stringify({ baseVersion: input.baseVersion, payload: input.payload }),
  });
}

export async function deleteCloudEntity(input: { entityType: string; entityId: string; baseVersion: number }): Promise<void> {
  await request<void>(`/cloud/entities/${encodeURIComponent(input.entityType)}/${encodeURIComponent(input.entityId)}`, {
    method: "DELETE",
    body: JSON.stringify({ baseVersion: input.baseVersion }),
  });
}
