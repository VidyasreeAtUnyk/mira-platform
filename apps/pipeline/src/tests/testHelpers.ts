import { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Side-effect import only: ../lib/db registers pg's NUMERIC type parser at
// module load time (types.setTypeParser mutates pg's global registry, not a
// per-Pool setting), so numeric columns (price, offer_price, old/new_price,
// ...) come back as JS numbers here too, not strings -- same gotcha as
// apps/lead-agent/src/db/client.ts, see that file's comment for why.
import "../lib/db";

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
  "003_transaction_pipeline_and_listings.sql",
);

/**
 * Dedicated test database, separate from the dev database so `npm run test`
 * never touches dev fixtures -- same discipline as
 * apps/lead-agent/src/tests/testHelpers.ts. No credentials embedded (see
 * CLAUDE.md); TEST_DATABASE_URL must come from the environment when it
 * differs from this same-machine, no-password local default.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://localhost:5432/mira_pipeline_test";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
    schemaReady = (async () => {
      await pool!.query(readFileSync(SHARED_SCHEMA_PATH, "utf-8"));
      await pool!.query(readFileSync(PIPELINE_MIGRATION_PATH, "utf-8"));
    })();
  }
  return pool;
}

/**
 * Fully isolated db for unit tests -- truncates every table first, so each
 * call starts from the same empty state regardless of what earlier tests in
 * this same `npm run test` process left behind. Tests build their own
 * fixture rows on top of this (their own agent/lead/property ids via
 * randomUUID()-backed inserts) rather than relying on any seeded data.
 */
export async function createTestDb(): Promise<Pool> {
  const p = getPool();
  await schemaReady;
  // CASCADE clears transaction_stage_history/transactions/listing_price_changes
  // along with everything else listed, instead of hand-ordering every FK.
  await p.query(
    `TRUNCATE audit_log, proposals, ai_suggestions, interactions, engagement_events,
      transaction_stage_history, transactions, listing_price_changes,
      property_price_history, properties, leads, agents CASCADE`,
  );
  return p;
}

/** Closes the shared test pool -- call once at the very end of the test run so the process can exit. */
export async function closeTestDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    schemaReady = null;
  }
}

export interface Test {
  name: string;
  run: () => void | Promise<void>;
}

export function assertTrue(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${message}`);
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

export async function assertThrows(fn: () => Promise<unknown>, message: string): Promise<void> {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error(`Assertion failed: ${message} (expected function to throw, but it did not)`);
}

/** Minimal fixture helpers shared across test files. */
export async function seedMinimalAgent(db: Pool): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO agents (name, email, role) VALUES ('Test Agent', 'test-agent-' || uuid_generate_v4() || '@example.com', 'agent') RETURNING id`,
  );
  return r.rows[0].id;
}

export async function seedMinimalLead(db: Pool): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO leads (name, phone, source, segment, stage, do_not_contact)
     VALUES ('Test Lead', '+971-50-000-0000', 'website_form', 'prospect', 'decision_pending', false)
     RETURNING id`,
  );
  return r.rows[0].id;
}

export async function seedMinimalProperty(db: Pool, price = 1000000): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO properties (address, area, type, price, bedrooms, tier)
     VALUES ('Test Address', 'Test Area', 'apartment', $1, 2, 'standard')
     RETURNING id`,
    [price],
  );
  return r.rows[0].id;
}
