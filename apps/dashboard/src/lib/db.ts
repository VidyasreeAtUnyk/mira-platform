/**
 * Read-only Postgres access for the shared schema (packages/shared-db).
 *
 * Unlike apps/lead-agent's src/db/client.ts, this module never applies
 * schema.sql -- the dashboard is a consumer of the shared data layer, not a
 * provisioner of it. If the database or tables don't exist yet, queries will
 * fail loudly (see the error boundary in src/app/error.tsx) rather than the
 * dashboard silently creating tables as a side effect of being loaded.
 *
 * No credentials are hardcoded (CLAUDE.md): DATABASE_URL must come from the
 * environment. The fallback below is a same-machine, no-password local dev
 * database (see packages/shared-db/README.md and .env.example), the same
 * pattern apps/lead-agent uses -- not a production connection string.
 */
import { Pool, types } from "pg";

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
