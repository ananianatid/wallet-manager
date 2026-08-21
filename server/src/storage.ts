import * as Minio from "minio";
import { config } from "./config.js";

const client = new Minio.Client({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY,
});

export async function ensureStorageBucket(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      if (!(await client.bucketExists(config.MINIO_BUCKET))) {
        await client.makeBucket(config.MINIO_BUCKET, "us-east-1");
      }
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

export async function putAttachment(objectKey: string, content: Buffer, mimeType: string): Promise<void> {
  await client.putObject(config.MINIO_BUCKET, objectKey, content, content.byteLength, { "Content-Type": mimeType });
}

export async function getAttachmentUrl(objectKey: string): Promise<string> {
  return client.presignedGetObject(config.MINIO_BUCKET, objectKey, 900);
}

export async function removeAttachment(objectKey: string): Promise<void> {
  await client.removeObject(config.MINIO_BUCKET, objectKey);
}
