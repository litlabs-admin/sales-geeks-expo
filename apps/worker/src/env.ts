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
if (envFile) config({ path: envFile });

export const env = z
  .object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    WORKER_PORT: z.coerce.number().default(8082)
  })
  .parse(process.env);
