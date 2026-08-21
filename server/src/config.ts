import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  WEB_ORIGIN: z.string().url(),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  EMAIL_VERIFICATION_REQUIRED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().email(),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().email(),
  PUBLIC_API_URL: z.string().url(),
  MINIO_ENDPOINT: z.string().default("minio"),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  MINIO_ACCESS_KEY: z.string().min(1).default("wallet-minio"),
  MINIO_SECRET_KEY: z.string().min(1).default("change-me"),
  MINIO_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/).default("wallet-attachments"),
});

export const config = schema.parse(process.env);
