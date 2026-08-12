/**
 * Wipes apps/trackers-owned data (goals + progress entries) from the local
 * scratch Postgres. Schema is left in place. Run `npm run seed` afterward.
 * Does NOT touch `agents` -- other apps sharing the same database may
 * depend on those rows; scripts/seed.ts manages its own three seed agents
 * by email instead.
 */

import { getDb, ready, closeDb } from "../src/lib/db";

async function main() {
  const pool = getDb();
  await ready();
  await pool.query("TRUNCATE goal_progress_entries, goals CASCADE");
  console.log('Wiped all apps/trackers goal data. Run "npm run seed" to recreate it.');
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
