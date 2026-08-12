import { Pool, types } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Same gotcha as apps/lead-agent/src/db/client.ts: pg returns `numeric`
// columns (price, commission_rate, size_sqft, ...) as strings by default.
// This app's matching logic (src/domain/matching.ts) does real arithmetic
// comparisons against lead budgets -- parse eagerly here, once.
types.setTypeParser(types.builtins.NUMERIC, (val) => (val === null ? null : parseFloat(val)));

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
