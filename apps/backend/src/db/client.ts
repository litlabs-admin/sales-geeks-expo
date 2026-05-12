import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

export const sql = postgres(env.DATABASE_POOL_URL ?? env.DATABASE_URL, {
  max: env.PG_POOL_MAX,
  prepare: false
});
export const db = drizzle(sql, { schema });
