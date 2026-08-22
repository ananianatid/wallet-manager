export interface CloudUser {
  id: string;
  email: string;
  emailVerified: boolean;
  workspaceId: string;
}

export interface CloudSession {
  id: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface CloudAttachment {
  id: string;
  entityType: string;
  entityId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface SyncChange {
  clientChangeId?: number;
  localId?: number;
  sequence?: number;
  entityType: string;
  entityId: string;
  version: number;
  baseVersion?: number | null;
  operation: "upsert" | "delete";
  payload: Record<string, unknown> | null;
  deviceId?: string | null;
  createdAt?: string;
}

export interface SyncConflict {
  entityType: string;
  entityId: string;
  serverVersion: number;
  serverPayload: unknown;
  serverOperation?: "upsert" | "delete";
  localId?: number;
}

export interface CloudEntity {
  entityType: string;
  entityId: string;
  version: number;
  payload: Record<string, unknown> | null;
  deletedAt: string | null;
  updatedAt: string;
}

export interface CloudBootstrap {
  workspaceId: string;
  entities: CloudEntity[];
}
