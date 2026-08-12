import { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "../db/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_SCHEMA_PATH = path.join(__dirname, "..", "..", "..", "..", "packages", "shared-db", "schema.sql");
const LOCAL_SCHEMA_PATH = path.join(__dirname, "..", "db", "local-schema.sql");

/**
 * Dedicated test database, separate from the dev database so `npm run test`
 * never touches dev fixtures. No credentials embedded -- same no-password
 * local convention as db/client.ts's DEFAULT_DATABASE_URL.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://localhost:5432/mira_leadagent_test";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
    schemaReady = (async () => {
      await pool!.query(readFileSync(SHARED_SCHEMA_PATH, "utf-8"));
      await pool!.query(readFileSync(LOCAL_SCHEMA_PATH, "utf-8"));
    })();
  }
  return pool;
}

/**
 * Fully isolated db for unit tests -- truncates every table first, so each
 * call starts from the same empty state the old `:memory:` SQLite db gave
 * each test, regardless of what earlier tests in this same `npm run test`
 * process left behind. Tests build their own fixture rows on top of this
 * (they generate their own lead/property ids via randomUUID() -- see
 * seedMinimalLead in each test file) rather than relying on any seeded data.
 */
export async function createTestDb(): Promise<Db> {
  const p = getPool();
  await schemaReady;
  // CASCADE: apps/crm's `interactions`/`ai_suggestions` tables also FK onto
  // `leads` (see packages/shared-db/schema.sql) but aren't lead-agent's to
  // manage -- CASCADE clears them along with everything actually listed here
  // instead of listing every table with an inbound FK by hand.
  await p.query(
    "TRUNCATE audit_log, proposals, engagement_events, property_price_history, properties, leads, run_state, run_metrics CASCADE"
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
