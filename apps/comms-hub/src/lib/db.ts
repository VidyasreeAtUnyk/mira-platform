/**
 * Postgres access for comms-hub's own tables (supabase/migrations/
 * 001_comms_hub_schema.sql) plus read-only access to the shared `leads`/
 * `agents` tables it references by FK. Same pattern as every other module
 * this session (apps/dashboard, apps/pipeline, apps/trackers,
 * apps/inventory's src/lib or src/db/client.ts) -- no credentials
 * hardcoded, DATABASE_URL from the environment, a local no-password dev
 * fallback matching the rest of the monorepo.
 *
 * RESOLVED (was a documented gap, see PROGRESS-integration.md): this app
 * used to read/write only in-memory mock data (src/components/
 * comms-store.tsx, since deleted) because no live database connection
 * existed anywhere in this build. It now applies its own migration and
 * reads/writes real Postgres, same as every other module.
 */
import { Pool, types } from "pg";

// Same three type-parser fixes apps/dashboard's src/lib/db.ts needed,
// found the same way (by actually running queries against seeded data,
// not by typechecking) -- see that file's comments for the full
// reasoning on each. Registered here too since this app now runs its own
// queries against the same column types (timestamptz created_at/
// last_message_at).
types.setTypeParser(types.builtins.NUMERIC, (val) => (val === null ? null : parseFloat(val)));
types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => (val === null ? null : new Date(val).toISOString()));
types.setTypeParser(types.builtins.TIMESTAMP, (val) => (val === null ? null : new Date(val).toISOString()));
types.setTypeParser(types.builtins.DATE, (val) => val);

export const DEFAULT_DATABASE_URL = "postgres://localhost:5432/mira_dev";

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });
  }
  return pool;
}
