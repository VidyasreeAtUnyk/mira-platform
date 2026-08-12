import { getDb, ready, closeDb } from "../lib/db";

/**
 * Postgres has no db file to delete -- "reset" means wiping every row in
 * every table this app owns or shares, schema left in place. Run
 * "npm run seed" afterward to repopulate fixtures. Mirrors
 * apps/lead-agent/src/db/reset.ts's wipe list, extended with the
 * pipeline-owned tables packages/shared-db/migrations/006_...sql added.
 */
async function main() {
  const db = getDb();
  await ready();
  await db.query(
    `TRUNCATE audit_log, proposals, ai_suggestions, interactions, engagement_events,
      transaction_stage_history, transactions, listing_price_changes,
      property_price_history, properties, leads, agents CASCADE`,
  );
  console.log('Wiped all pipeline/shared-schema data. Run "npm run seed" to recreate it.');
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
