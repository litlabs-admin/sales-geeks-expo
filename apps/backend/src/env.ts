import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { z } from "zod";

const envCandidates = [
  process.env.DOTENV_CONFIG_PATH,
  resolve(process.cwd(), ".env.local"),
  resolve(process.cwd(), "..", "..", ".env.local"),
  resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".env.local")
].filter(Boolean) as string[];

const envFile = envCandidates.find((candidate) => existsSync(candidate));
if (envFile) {
  config({ path: envFile });
}

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: z.string().url().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  NEXT_PUBLIC_BACKEND_URL: z.string().url().optional(),
  BACKEND_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  SUPABASE_JWT_SECRET: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  QR_SIGNING_SECRET: z.string().min(16),
  CALENDLY_WEBHOOK_SECRET: z.string().min(16),
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),
  NODE_ENV: z.string().default("development")
});

export const env = envSchema.parse(process.env);
