/**
 * apps/pipeline seed script -- populates a dev/test database with a
 * realistic set of agents/leads/properties (listings) plus transactions
 * driven through several real pipeline-stage transitions.
 *
 * Deliberately calls the actual lib functions (src/lib/transactions.ts's
 * createTransaction/transitionTransaction, src/lib/listings.ts's
 * recordPriceChange/updateListingStatus) instead of raw INSERTs for the
 * pipeline-owned tables, the same way apps/lead-agent/src/db/seed.ts wipes
 * then rebuilds fixtures -- this both produces a legally-reachable pipeline
 * state (every transaction's history is a real sequence of legal
 * transitions, not a hand-picked terminal row) and doubles as a smoke test
 * that the stage machine + price-change logic actually run end to end
 * against a real database.
 */
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { getDb, ready } from "../lib/db";
import { createTransaction, transitionTransaction } from "../lib/transactions";
import { recordPriceChange, updateListingStatus } from "../lib/listings";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

/** YYYY-MM-DD, n days from now (negative n = in the future) -- for the `date`-typed expected_closing_date column. */
function dateOffset(n: number): string {
  return daysAgo(n).slice(0, 10);
}

export interface SeedIds {
  agents: { priya: string; omar: string };
  leads: { alice: string; ben: string; carla: string; deepak: string };
  properties: {
    marinaTower: string;
    palmVilla: string;
    downtownLoft: string;
    hillsTownhouse: string;
    oldStudio: string;
  };
  transactions: { aliceDeal: string; benDeal: string; carlaDeal: string; deepakDeal: string };
}

/**
 * Wipes every table this app owns or shares, then rebuilds fixtures.
 * Mirrors apps/lead-agent/src/db/reset.ts + seed.ts's wipe list, extended
 * with the pipeline-owned tables this migration added. Run against a
 * dedicated pipeline dev/test database (see .env.example) -- this is a
 * destructive TRUNCATE, never point it at a shared/production database.
 */
export async function seedDatabase(db: Pool): Promise<SeedIds> {
  await db.query(
    `TRUNCATE audit_log, proposals, ai_suggestions, interactions, engagement_events,
      transaction_stage_history, transactions, listing_price_changes,
      property_price_history, properties, leads, agents CASCADE`,
  );

  async function insertAgent(name: string, email: string): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO agents (name, email, role) VALUES ($1, $2, 'agent') RETURNING id`,
      [name, email],
    );
    return r.rows[0].id;
  }

  const priya = await insertAgent("Priya Nair", "priya.nair@example.com");
  const omar = await insertAgent("Omar Haddad", "omar.haddad@example.com");

  async function insertLead(name: string, phone: string, agentId: string, stage: string): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO leads (agent_id, name, phone, source, segment, stage, lead_type, do_not_contact)
       VALUES ($1, $2, $3, 'referral', 'client', $4, 'buyer', false) RETURNING id`,
      [agentId, name, phone, stage],
    );
    return r.rows[0].id;
  }

  // All four leads are already past CRM's `decision_pending`/`won` stage --
  // a transaction only gets created once a lead has progressed to a real
  // deal in motion (see src/lib/stage-machine.ts's header).
  const alice = await insertLead("Alice Fernandes", "+971-50-100-0001", priya, "decision_pending");
  const ben = await insertLead("Ben Castillo", "+971-50-100-0002", priya, "decision_pending");
  const carla = await insertLead("Carla D'Souza", "+971-50-100-0003", omar, "won");
  const deepak = await insertLead("Deepak Menon", "+971-50-100-0004", omar, "decision_pending");

  async function insertProperty(
    address: string,
    area: string,
    type: string,
    price: number,
    bedrooms: number,
    tier: "standard" | "upgrade",
    listedDaysAgo: number,
  ): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO properties (address, area, type, price, bedrooms, tier, listed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [address, area, type, price, bedrooms, tier, daysAgo(listedDaysAgo)],
    );
    return r.rows[0].id;
  }

  const marinaTower = await insertProperty("Marina Tower, Unit 2104", "Dubai Marina", "apartment", 2400000, 2, "upgrade", 40);
  const palmVilla = await insertProperty("Palm Jumeirah Villa 12", "Palm Jumeirah", "villa", 9800000, 5, "upgrade", 90);
  const downtownLoft = await insertProperty("Downtown Loft 803", "Downtown Dubai", "apartment", 1650000, 1, "standard", 15);
  const hillsTownhouse = await insertProperty("Dubai Hills Townhouse 44", "Dubai Hills Estate", "townhouse", 3200000, 3, "upgrade", 200);
  const oldStudio = await insertProperty("JVC Studio 12B", "Jumeirah Village Circle", "apartment", 650000, 0, "standard", 260);

  // Exercises src/lib/listings.ts's recordPriceChange (two successive cuts,
  // proving old_price is read from the row, not trusted from the caller)
  // and updateListingStatus (an in-progress deal + a withdrawn stale listing).
  await recordPriceChange(db, {
    property_id: hillsTownhouse,
    new_price: 3050000,
    reason: "Reduced after 60 days with no offers",
    changed_by: omar,
  });
  await recordPriceChange(db, {
    property_id: hillsTownhouse,
    new_price: 2950000,
    reason: "Second reduction, seller motivated",
    changed_by: omar,
  });
  await updateListingStatus(db, downtownLoft, "under_offer");
  await updateListingStatus(db, oldStudio, "withdrawn");

  // Four transactions covering: mid-pipeline, a full closed_won run through
  // every stage, a closed_lost (with required lost_reason), and a
  // freshly-created one still at the entry stage ('showing').
  const aliceDeal = (
    await createTransaction(db, { lead_id: alice, property_id: marinaTower, agent_id: priya, notes: "First showing went well" })
  ).id;
  await transitionTransaction(db, aliceDeal, {
    to_stage: "offer",
    changed_by: priya,
    offer_price: 2350000,
    note: "Buyer submitted formal offer",
  });
  await transitionTransaction(db, aliceDeal, {
    to_stage: "under_contract",
    changed_by: priya,
    contract_price: 2380000,
    note: "Seller countered, buyer accepted",
  });

  const benDeal = (await createTransaction(db, { lead_id: ben, property_id: palmVilla, agent_id: priya })).id;
  await transitionTransaction(db, benDeal, { to_stage: "offer", changed_by: priya, offer_price: 9500000 });
  await transitionTransaction(db, benDeal, { to_stage: "under_contract", changed_by: priya, contract_price: 9600000 });
  await transitionTransaction(db, benDeal, { to_stage: "inspection", changed_by: priya, note: "Structural inspection scheduled" });
  await transitionTransaction(db, benDeal, {
    to_stage: "closing",
    changed_by: priya,
    expected_closing_date: dateOffset(-14),
  });
  await transitionTransaction(db, benDeal, { to_stage: "closed_won", changed_by: priya, note: "Deal closed" });

  const carlaDeal = (await createTransaction(db, { lead_id: carla, property_id: downtownLoft, agent_id: omar })).id;
  await transitionTransaction(db, carlaDeal, { to_stage: "offer", changed_by: omar, offer_price: 1600000 });
  await transitionTransaction(db, carlaDeal, {
    to_stage: "closed_lost",
    changed_by: omar,
    lost_reason: "Buyer's financing fell through",
  });

  const deepakDeal = (
    await createTransaction(db, {
      lead_id: deepak,
      property_id: hillsTownhouse,
      agent_id: omar,
      notes: "Interested after price reduction",
    })
  ).id;

  return {
    agents: { priya, omar },
    leads: { alice, ben, carla, deepak },
    properties: { marinaTower, palmVilla, downtownLoft, hillsTownhouse, oldStudio },
    transactions: { aliceDeal, benDeal, carlaDeal, deepakDeal },
  };
}

async function main() {
  const db = getDb();
  await ready();
  const ids = await seedDatabase(db);
  console.log("Seeded pipeline database.");
  console.log(JSON.stringify(ids, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
