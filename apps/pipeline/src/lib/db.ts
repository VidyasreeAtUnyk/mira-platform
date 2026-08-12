import { Pool, types } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Same gotcha as apps/lead-agent/src/db/client.ts: pg returns `numeric`
// columns (price, offer_price, contract_price, avg_price, old_price,
// new_price, ...) as strings by default. Every numeric field this app
// touches (offer/contract prices, price-change amounts) is a plain
// AED/currency figure well within safe-float range -- parse eagerly here,
// once, instead of at every call site (findMatching/DOM-calc code would
// otherwise silently do string concatenation instead of arithmetic).
types.setTypeParser(types.builtins.NUMERIC, (val) => (val === null ? null : parseFloat(val)));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_SCHEMA_PATH = path.join(__dirname, "..", "..", "..", "..", "packages", "shared-db", "schema.sql");
const PIPELINE_MIGRATION_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "packages",
  "shared-db",
  "migrations",
  "006_transaction_pipeline_and_listings.sql",
);

/**
 * No credentials are hardcoded here (CLAUDE.md). DATABASE_URL must come
 * from the environment; this fallback is a same-machine, no-password local
 * dev database, mirroring apps/lead-agent's DEFAULT_DATABASE_URL pattern --
 * not a production connection string.
 */
export const DEFAULT_DATABASE_URL = "postgres://localhost:5432/mira_pipeline_dev";

let instance: Pool | null = null;
let instanceUrl: string | null = null;
let schemaApplied: Promise<void> | null = null;

/**
 * Every entry point (Next.js route handler, seed/reset script, test) gets
 * the pool via this function rather than constructing its own. Applies the
 * Phase 0 shared schema (packages/shared-db/schema.sql) plus this module's
 * additive migration (packages/shared-db/migrations/006_...sql) on first
 * use -- same idempotent "apply on startup" pattern as
 * apps/lead-agent/src/db/client.ts. schema.sql MUST run before the
 * migration (the migration ALTERs `properties` and references `leads`/
 * `agents`), so the two are applied in sequence, not in parallel.
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
  await pool.query(sharedSchema);
  const pipelineMigration = readFileSync(PIPELINE_MIGRATION_PATH, "utf-8");
  await pool.query(pipelineMigration);
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
