import { Pool, types } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnvFile } from "../config/env.js";

// Loaded here (not just in src/cli/index.ts) so every entry point that
// imports this module -- seed.ts, reset.ts, the CLI -- reliably picks up
// .env's DATABASE_URL regardless of which one is the actual process entry
// point, instead of silently depending on the shell's own environment.
loadEnvFile();

// Same gotcha as apps/lead-agent/src/db/client.ts: pg returns `numeric`
// columns (price, commission_rate, size_sqft, ...) as strings by default.
// This app's matching logic (src/domain/matching.ts) does real arithmetic
// comparisons against lead budgets -- parse eagerly here, once.
types.setTypeParser(types.builtins.NUMERIC, (val) => (val === null ? null : parseFloat(val)));

// A second, module-specific gotcha (found while manually exercising the CLI
// against real data -- `mou_terms.term_start`/`term_end` are `date` columns):
// pg's default parser turns those into JS Date objects at UTC midnight, but
// every domain type in src/domain/types.ts declares them `string` (same
// plain-ISO-string convention as every other date/timestamp field in this
// app). Left unparsed, that mismatch is silent -- it still typechecks, and
// `new Date(term.term_start)` even still "works" on a Date input -- but a
// Date object printed directly (e.g. a CLI confirmation message) renders as
// a verbose `Thu Jan 01 2026 00:00:00 GMT+0000 (...)` string instead of
// `2026-01-01`, and any future code doing plain string ops on a "string"
// field would break at runtime despite the type declaration. Force it back
// to the raw `YYYY-MM-DD` wire string so the declared type is actually true.
types.setTypeParser(types.builtins.DATE, (val) => val);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_SCHEMA_PATH = path.join(__dirname, "..", "..", "..", "..", "packages", "shared-db", "schema.sql");
const INVENTORY_MIGRATION_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "packages",
  "shared-db",
  "migrations",
  "006_developer_inventory.sql"
);

/**
 * No credentials are hardcoded here (CLAUDE.md) -- DATABASE_URL must come
 * from the environment. This fallback is a same-machine, no-password* local
 * dev database, not a production connection string.
 * (*if your local Postgres requires a password for TCP connections, set
 * DATABASE_URL explicitly -- see .env.example.)
 */
export const DEFAULT_DATABASE_URL = "postgres://localhost:5432/mira_inventory_dev";

let instance: Pool | null = null;
let instanceUrl: string | null = null;
let schemaApplied: Promise<void> | null = null;

/**
 * Same "apply on startup" pattern as apps/lead-agent/src/db/client.ts:
 * applies Phase 0's shared schema.sql, then this module's additive
 * migration on top. Idempotent (every statement is `create table if not
 * exists` / `create index if not exists` / `drop trigger if exists` +
 * `create trigger`), safe to run against a database that already has it.
 */
export function getDb(databaseUrl: string = process.env.DATABASE_URL || DEFAULT_DATABASE_URL): Pool {
  if (instance && instanceUrl === databaseUrl) return instance;
  if (instance) void instance.end();
  const pool = new Pool({ connectionString: databaseUrl });
  instance = pool;
  instanceUrl = databaseUrl;
  schemaApplied = applySchema(pool);
  return pool;
}

/** Awaited by entry points before issuing queries -- schema application is async, pool creation isn't. */
export async function ready(): Promise<void> {
  await schemaApplied;
}

async function applySchema(pool: Pool): Promise<void> {
  const sharedSchema = readFileSync(SHARED_SCHEMA_PATH, "utf-8");
  const inventoryMigration = readFileSync(INVENTORY_MIGRATION_PATH, "utf-8");
  await pool.query(sharedSchema);
  await pool.query(inventoryMigration);
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.end();
    instance = null;
    instanceUrl = null;
    schemaApplied = null;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
