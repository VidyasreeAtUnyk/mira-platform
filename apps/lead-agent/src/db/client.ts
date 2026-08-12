import { Pool, types } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// pg returns `numeric` columns (budget_min/budget_max/price/avg_price) as
// strings by default, to avoid silent float precision loss on values too
// large for a JS number. This app's numeric columns are all plain money/
// price figures well within safe-float range, and callers throughout
// (findMatchingProperties, getPropertyMarketData's regression, stateMachine)
// expect real numbers -- parse eagerly here, once, instead of at every call site.
types.setTypeParser(types.builtins.NUMERIC, (val) => (val === null ? null : parseFloat(val)));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_SCHEMA_PATH = path.join(__dirname, "..", "..", "..", "..", "packages", "shared-db", "schema.sql");
const LOCAL_SCHEMA_PATH = path.join(__dirname, "local-schema.sql");

/**
 * No credentials are hardcoded here (CLAUDE.md) -- DATABASE_URL must come
 * from the environment. This fallback is a same-machine, no-password local
 * dev/test database (see packages/shared-db/README.md), not a production
 * connection string.
 */
export const DEFAULT_DATABASE_URL = "postgres://localhost:5432/mira_leadagent_dev";

let instance: Pool | null = null;
let instanceUrl: string | null = null;
let schemaApplied: Promise<void> | null = null;

/**
 * Every process (CLI command, agent run, eval scenario) gets the pool via
 * this function rather than constructing its own -- this is what makes the
 * system resumable after a kill: nothing but what's already committed to
 * Postgres needs to survive a restart. Applies the shared schema (packages/
 * shared-db/schema.sql) plus this app's own local-only tables on first use,
 * same idempotent "apply on startup" pattern as the old SQLite client.
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
  const localSchema = readFileSync(LOCAL_SCHEMA_PATH, "utf-8");
  await pool.query(sharedSchema);
  await pool.query(localSchema);
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
