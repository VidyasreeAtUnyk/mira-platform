import { loadEnvFile } from "../config/env.js";
loadEnvFile(); // must run before TEST_DATABASE_URL below is read from process.env

import { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "../db/types.js";

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
  "004_developer_inventory.sql"
);

/**
 * Dedicated test database, separate from the dev database so `npm run test`
 * never touches dev fixtures -- same convention as
 * apps/lead-agent/src/tests/testHelpers.ts. No credentials embedded.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://localhost:5432/mira_inventory_test";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
    schemaReady = (async () => {
      await pool!.query(readFileSync(SHARED_SCHEMA_PATH, "utf-8"));
      await pool!.query(readFileSync(INVENTORY_MIGRATION_PATH, "utf-8"));
    })();
  }
  return pool;
}

/**
 * Fully isolated db for unit tests -- truncates every table this app cares
 * about first (both its own tables and the shared `leads` table it reads
 * for matching), so each test starts from the same empty state regardless
 * of what earlier tests in this same `npm run test` process left behind.
 * Tests build their own fixture rows on top of this via seedMinimalLead-
 * style helpers in each test file, rather than relying on seed.ts's data.
 */
export async function createTestDb(): Promise<Db> {
  const p = getPool();
  await schemaReady;
  await p.query("TRUNCATE inventory_units, mou_terms, developer_partners, audit_log, leads CASCADE");
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
    throw new Error(`Assertion failed: ${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}
