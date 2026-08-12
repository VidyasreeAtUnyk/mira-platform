/**
 * Postgres access for apps/trackers.
 *
 * Architectural decision (documented per CLAUDE.md -- flag deviations from
 * what SPEC.md obviously implies): apps/crm reads data through supabase-js's
 * `.from()` query builder, which talks to Supabase's hosted PostgREST/GoTrue
 * stack over HTTPS. That stack does not exist anywhere in this sandbox (no
 * live Supabase project -- same blocker PROGRESS-phase0.md and
 * apps/lead-agent's client.ts already flag), and standing up the full local
 * Supabase CLI stack (Postgres + GoTrue + PostgREST + Kong containers) was
 * judged out of scope for a single-session module build.
 *
 * apps/trackers instead follows the pattern apps/lead-agent already
 * established in this same repo for exactly this situation: connect directly
 * via `pg` against `DATABASE_URL`. This is also a legitimate *production*
 * pattern for a Next.js server talking to a Supabase-hosted Postgres (direct
 * connection / pooler, bypassing PostgREST) -- not merely a dev shim. Two
 * consequences that follow from *not* going through PostgREST:
 *
 *   1. Row-level security policies (apps/trackers/supabase/migrations/001_goals.sql)
 *      are NOT enforced on this path -- Postgres RLS only applies to the role
 *      PostgREST connects as, not a superuser/app-role `pg` session. They
 *      still matter as defense-in-depth for any other client that *does* go
 *      through PostgREST (mobile app, direct REST calls), and as the
 *      canonical policy statement for a human to review.
 *   2. Authorization equivalent to those RLS policies is therefore
 *      enforced in application code instead -- see src/lib/goals.ts's
 *      `assertCanView` / `assertCanEdit` helpers, which must be kept in sync
 *      with the RLS policy file by hand. Flagging this as a real
 *      maintenance risk for a human to weigh, not glossing over it.
 *
 * Schema application mirrors apps/lead-agent/src/db/client.ts's pattern:
 * apply packages/shared-db/schema.sql then migrations/001_trackers_goals.sql
 * on first use, idempotently (`create table if not exists`).
 */

import { Pool, type QueryResultRow, types } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

// Same reasoning as apps/lead-agent/src/db/client.ts: numeric columns
// (target_value, goal_progress_entries.value) come back from `pg` as
// strings by default to avoid silent float-precision loss on values outside
// safe-integer range. Goal targets/progress values here are always plain
// counts or AED amounts well within safe-float range, and every call site
// expects a real `number` -- parse eagerly, once, here.
types.setTypeParser(types.builtins.NUMERIC, (val) => (val === null ? null : parseFloat(val)));

// `date` columns (goals.period_start/period_end, goal_progress_entries.entry_date)
// come back from `pg` as JS Date objects by default, converted through the
// server's local timezone -- a real correctness bug for date-only values
// (can shift the calendar day). packages/shared-types models these as plain
// "YYYY-MM-DD" strings, and src/lib/goals.ts's streak calculation does
// string comparisons against them -- keep the raw string instead.
types.setTypeParser(types.builtins.DATE, (val) => val);

const SHARED_SCHEMA_PATH = path.join(process.cwd(), "..", "..", "packages", "shared-db", "schema.sql");
const TRACKERS_MIGRATION_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  "packages",
  "shared-db",
  "migrations",
  "001_trackers_goals.sql"
);

/**
 * No credentials are hardcoded here (CLAUDE.md) -- DATABASE_URL must come
 * from the environment. This fallback is a same-machine, no-password local
 * dev/test database (see packages/shared-db/README.md), not a production
 * connection string.
 */
export const DEFAULT_DATABASE_URL = "postgres://localhost:5432/mira_trackers_dev";

let instance: Pool | null = null;
let instanceUrl: string | null = null;
let schemaApplied: Promise<void> | null = null;

export function getDb(databaseUrl: string = process.env.DATABASE_URL || DEFAULT_DATABASE_URL): Pool {
  if (instance && instanceUrl === databaseUrl) return instance;
  if (instance) void instance.end();
  const pool = new Pool({ connectionString: databaseUrl });
  instance = pool;
  instanceUrl = databaseUrl;
  schemaApplied = applySchema(pool);
  return pool;
}

/** Awaited before issuing queries from request handlers -- schema application is async, pool creation isn't. */
export async function ready(): Promise<void> {
  await schemaApplied;
}

async function applySchema(pool: Pool): Promise<void> {
  const sharedSchema = readFileSync(SHARED_SCHEMA_PATH, "utf-8");
  const trackersMigration = readFileSync(TRACKERS_MIGRATION_PATH, "utf-8");
  await pool.query(sharedSchema);
  await pool.query(trackersMigration);
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.end();
    instance = null;
    instanceUrl = null;
    schemaApplied = null;
  }
}

/** Convenience wrapper: get the ready pool in one call from a server component/action. */
export async function db(): Promise<Pool> {
  const pool = getDb();
  await ready();
  return pool;
}

export type { QueryResultRow };
