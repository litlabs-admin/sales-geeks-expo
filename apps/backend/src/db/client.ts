import postgres from "postgres";
import { env } from "../env";

// Single shared Postgres connection pool. All backend handlers use this
// `sql` tagged-template client directly — there is no ORM layer. prepare:false
// is required for transaction-mode pooling (Supabase pgBouncer on :6543).
export const sql = postgres(env.DATABASE_POOL_URL ?? env.DATABASE_URL, {
  max: env.PG_POOL_MAX,
  prepare: false
});
