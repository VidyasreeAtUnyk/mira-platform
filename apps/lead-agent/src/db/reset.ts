import { getDb, ready } from "./client.js";

/**
 * Postgres has no db file to delete (unlike the old SQLite client) --
 * "reset" means wiping every row in every table this app owns or shares,
 * schema left in place. Run "npm run seed" afterward to repopulate fixtures.
 */
async function main() {
  const db = getDb();
  await ready();
  await db.query(
    "TRUNCATE audit_log, proposals, engagement_events, property_price_history, properties, leads, run_state, run_metrics CASCADE"
  );
  console.log('Wiped all lead-agent/shared-schema data. Run "npm run seed" to recreate it.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
