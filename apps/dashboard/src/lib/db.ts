/**
 * Postgres access for the shared schema (packages/shared-db) plus this
 * app's own local tables (src/db/local-schema.sql).
 *
 * Still never applies packages/shared-db/schema.sql itself -- dashboard
 * remains a consumer of the shared Phase-0 data layer, not a provisioner
 * of it; if those tables don't exist yet, queries against them still fail
 * loudly (see src/app/error.tsx) rather than dashboard silently creating
 * them. RESOLVED as of the Meetings feature: dashboard now genuinely owns
 * one table (`meetings`) the same way apps/lead-agent owns run_state/
 * run_metrics, so it needs the same idempotent "apply my own local schema
 * on first connect" step those apps already have -- this is that, scoped
 * strictly to local-schema.sql, not the shared one.
 *
 * No credentials are hardcoded (CLAUDE.md): DATABASE_URL must come from the
 * environment. The fallback below is a same-machine, no-password local dev
 * database (see packages/shared-db/README.md and .env.example), the same
 * pattern apps/lead-agent uses -- not a production connection string.
 */
import { Pool, types } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// pg returns `numeric` columns (budget_min/budget_max/price/avg_price) as
// strings by default. This app only ever displays/sums/counts these for the
// Today view, so parse eagerly (same fix apps/lead-agent applies) instead of
// risking a string-concatenation bug at some future call site.
types.setTypeParser(types.builtins.NUMERIC, (val) => (val === null ? null : parseFloat(val)));

// pg also returns `timestamptz`/`timestamp` columns (last_contacted_at,
// next_followup_at, created_at, updated_at, locked_at) as JS `Date` objects
// by default -- but every shared row type (@mira/shared-types' `Lead`,
// `Agent`, etc.) declares these fields as ISO `string`, and src/lib/utils.ts'
// `timeAgo()` calls date-fns' `parseISO()` on them, which throws on a `Date`
// input. Normalize to ISO strings at the driver boundary so this app's data
// actually matches the shared contract it imports types from, instead of
// silently diverging (found by actually running this against seeded data,
// not by typechecking -- `pg`'s types aren't precise enough to catch this
// statically).
types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => (val === null ? null : new Date(val).toISOString()));
types.setTypeParser(types.builtins.TIMESTAMP, (val) => (val === null ? null : new Date(val).toISOString()));

// pg's default `date` (no time component -- e.g. mou_terms.term_end)
// handling is worse than timestamptz/timestamp above: it parses into a JS
// `Date` at local-timezone midnight, which both (a) isn't a string (crashes
// React: "Objects are not valid as a React child", found by actually
// rendering the Compliance Alerts widget, not by typechecking) and (b) can
// shift the calendar date by one depending on the server's timezone offset.
// The type parser callback receives the raw wire value ("2026-07-24")
// before any of that conversion happens -- returning it unchanged sidesteps
// both problems at once, unlike round-tripping through `new Date()` the way
// the timestamptz/timestamp parsers above do (fine for those, since they
// carry a real time+zone component to begin with).
types.setTypeParser(types.builtins.DATE, (val) => val);

export const DEFAULT_DATABASE_URL = "postgres://localhost:5432/mira_dev";

let pool: Pool | null = null;

export function getDb(): Pool {
  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}

let localSchemaApplied: Promise<void> | null = null;

/**
 * Applies src/db/local-schema.sql idempotently (CREATE TABLE/INDEX IF NOT
 * EXISTS -- safe to re-run) exactly once per process. Deliberately separate
 * from getDb() rather than folded into it: every existing query in this app
 * only ever touches tables from the shared Phase-0 schema, which already
 * exist by the time dashboard runs (see this file's header) -- only
 * src/lib/meetings.ts, the one genuinely dashboard-owned table, needs to
 * call this before querying.
 */
export function ensureLocalSchema(): Promise<void> {
  if (!localSchemaApplied) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const LOCAL_SCHEMA_PATH = path.join(__dirname, "..", "db", "local-schema.sql");
    localSchemaApplied = getDb().query(readFileSync(LOCAL_SCHEMA_PATH, "utf-8")).then(() => undefined);
  }
  return localSchemaApplied;
}
