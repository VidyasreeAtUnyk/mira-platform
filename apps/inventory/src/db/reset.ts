import { getDb, ready } from "./client.js";

/**
 * Postgres has no db file to delete -- "reset" means wiping every row in
 * every table this app owns, schema left in place, same convention as
 * apps/lead-agent/src/db/reset.ts. Deliberately does NOT truncate `leads`
 * (or any other shared/Phase-0 table) -- this module reads leads, it
 * doesn't own them; wiping them here would silently destroy another
 * module's data. Run "npm run seed" afterward to repopulate fixtures.
 */
async function main() {
  const db = getDb();
  await ready();
  await db.query("TRUNCATE inventory_units, mou_terms, developer_partners CASCADE");
  console.log('Wiped all apps/inventory data (developer_partners, mou_terms, inventory_units). Run "npm run seed" to recreate it.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
