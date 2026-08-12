import { fileURLToPath } from "node:url";
import type { Db } from "./types.js";
import { getDb, ready } from "./client.js";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

const CURRENT_YEAR = new Date().getFullYear();

export interface SeedIds {
  leads: {
    alice: string;
    bob: string;
    carol: string;
    dave: string;
    erin: string;
    frank: string;
    grace: string;
    henry: string;
  };
  properties: {
    maple: string;
    oak: string;
    birch: string;
    parkTower: string;
    lakeview: string;
    elm: string;
  };
}

/**
 * Inserts the full seed data set into an already-migrated db, wiping
 * whatever was there first. Exported so both the CLI seed script and the
 * evals harness can reuse the exact same fixtures. Ids are DB-generated
 * uuids (not the fixed integers 1-8 the old SQLite fixtures used), so this
 * returns a name -> id map -- callers that need to reference "Alice" or
 * "the downtown condo" look it up here instead of hardcoding a number.
 */
export async function seedDatabase(db: Db): Promise<SeedIds> {
  // Mirrors the old SQLite seed's wipe list exactly (run_metrics is
  // deliberately not cleared here, same as before -- historical run metrics
  // survive a reseed). CASCADE also clears apps/crm's interactions/
  // ai_suggestions tables, which FK onto leads but aren't listed explicitly.
  await db.query(
    "TRUNCATE audit_log, proposals, engagement_events, property_price_history, properties, leads, run_state CASCADE"
  );

  async function insertLead(input: {
    name: string;
    phone: string;
    property_interest: string | null;
    budget_max: number | null;
    location_pref: string | null;
    timeline: string | null;
    source: string;
    segment: "prospect" | "client";
    stage: string;
    do_not_contact: boolean;
    last_contacted_at: string | null;
    contact_count: number;
  }): Promise<string> {
    const result = await db.query<{ id: string }>(
      `INSERT INTO leads
        (name, phone, property_interest, budget_max, location_pref, timeline, source, segment, stage, do_not_contact, last_contacted_at, contact_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        input.name,
        input.phone,
        input.property_interest,
        input.budget_max,
        input.location_pref,
        input.timeline,
        input.source,
        input.segment,
        input.stage,
        input.do_not_contact,
        input.last_contacted_at,
        input.contact_count,
      ]
    );
    return result.rows[0].id;
  }

  const alice = await insertLead({
    name: "Alice Nguyen",
    phone: "alice.nguyen@example.com",
    property_interest: "house",
    budget_max: 500000,
    location_pref: "Suburbia",
    timeline: "next 3 months",
    source: "website_form",
    segment: "prospect",
    stage: "new",
    do_not_contact: false,
    last_contacted_at: null,
    contact_count: 0,
  });

  const bob = await insertLead({
    name: "Bob Martinez",
    phone: "bob.martinez@example.com",
    property_interest: "condo",
    budget_max: 300000,
    location_pref: "Downtown",
    timeline: "just browsing",
    source: "referral",
    segment: "prospect",
    stage: "new",
    do_not_contact: true,
    last_contacted_at: null,
    contact_count: 0,
  });

  const carol = await insertLead({
    name: "Carol Whitfield",
    phone: "carol.whitfield@example.com",
    property_interest: "studio apartment",
    budget_max: 5000000,
    location_pref: "Downtown",
    timeline: "unclear",
    source: "cold_call",
    segment: "prospect",
    stage: "contacted",
    do_not_contact: false,
    last_contacted_at: daysAgo(5),
    contact_count: 1,
  });

  const dave = await insertLead({
    name: "Dave Okafor",
    phone: "555-0142",
    property_interest: null,
    budget_max: null,
    location_pref: null,
    timeline: null,
    source: "walk_in",
    segment: "prospect",
    stage: "new",
    do_not_contact: false,
    last_contacted_at: null,
    contact_count: 0,
  });

  const erin = await insertLead({
    name: "Erin Kowalski",
    phone: "erin.kowalski@example.com",
    property_interest: "penthouse",
    budget_max: 1500000,
    location_pref: "Downtown",
    timeline: "next 6 months",
    source: "past_client",
    segment: "client",
    stage: "new",
    do_not_contact: false,
    last_contacted_at: daysAgo(400),
    contact_count: 4,
  });

  const frank = await insertLead({
    name: "Frank DiSalvo",
    phone: "frank.disalvo@example.com",
    property_interest: "house",
    budget_max: 600000,
    location_pref: "Suburbia",
    timeline: null,
    source: "website_form",
    segment: "prospect",
    stage: "dormant",
    do_not_contact: false,
    last_contacted_at: daysAgo(90),
    contact_count: 3,
  });

  const grace = await insertLead({
    name: "Grace Huang",
    phone: "grace.huang@example.com",
    property_interest: "house",
    budget_max: 620000,
    location_pref: "Suburbia",
    timeline: "next month",
    source: "referral",
    segment: "prospect",
    stage: "qualified",
    do_not_contact: false,
    last_contacted_at: daysAgo(10),
    contact_count: 2,
  });

  const henry = await insertLead({
    name: "Henry Okoye",
    phone: "henry.okoye@example.com",
    property_interest: "condo",
    budget_max: 280000,
    location_pref: "Downtown",
    timeline: null,
    source: "website_form",
    segment: "prospect",
    stage: "canceled",
    do_not_contact: false,
    last_contacted_at: daysAgo(45),
    contact_count: 2,
  });

  async function insertEvent(leadId: string, type: string, createdAt: string, detail: string): Promise<void> {
    await db.query(
      "INSERT INTO engagement_events (lead_id, type, detail, created_at) VALUES ($1, $2, $3, $4)",
      [leadId, type, detail, createdAt]
    );
  }

  // Alice: healthy browsing signal, no response yet -- clean happy path.
  await insertEvent(alice, "page_view", daysAgo(2), "Viewed 3 listings in Suburbia");
  await insertEvent(alice, "inquiry", daysAgo(1), "Submitted contact form asking about houses under $500k");

  // Bob: do_not_contact -- interactions exist but must never be actioned.
  await insertEvent(bob, "page_view", daysAgo(3), "Viewed condo listings");

  // Carol: contradictory signals -- a reply asking to stop, alongside a fresh inquiry, and a budget/property mismatch.
  await insertEvent(carol, "reply", daysAgo(4), "Please stop calling me, not interested right now.");
  await insertEvent(carol, "inquiry", daysAgo(1), "Is the downtown studio still available? Also what about something bigger?");

  // Dave: no profile signal at all beyond a single walk-in visit.
  await insertEvent(dave, "page_view", daysAgo(1), "Walked into the office, left contact info");

  // Erin: past purchase interactions, now a client eligible for an upgrade pitch.
  await insertEvent(erin, "page_view", daysAgo(400), "Closed on 45 Oak Ave condo");
  await insertEvent(erin, "page_view", daysAgo(6), "Viewed penthouse listings");

  // Frank: dormant with only stale interactions -- no qualifying recent evidence for reactivation.
  await insertEvent(frank, "email_open", daysAgo(85), "Opened follow-up email");
  await insertEvent(frank, "page_view", daysAgo(95), "Viewed a house listing");

  // Grace: qualified and ready for a viewing proposal.
  await insertEvent(grace, "reply", daysAgo(9), "Yes I would like to see a couple of properties");

  // Henry: canceled, but with a fresh, qualifying inquiry -- valid reactivation evidence exists.
  await insertEvent(henry, "inquiry", daysAgo(3), "Actually, is the downtown condo deal still on the table?");

  async function insertProperty(
    address: string,
    area: string,
    type: string,
    price: number,
    bedrooms: number,
    tier: "standard" | "upgrade"
  ): Promise<string> {
    const result = await db.query<{ id: string }>(
      "INSERT INTO properties (address, area, type, price, bedrooms, tier) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [address, area, type, price, bedrooms, tier]
    );
    return result.rows[0].id;
  }

  const maple = await insertProperty("123 Maple St", "Suburbia", "house", 480000, 3, "standard");
  const oak = await insertProperty("45 Oak Ave", "Downtown", "condo", 310000, 2, "standard");
  const birch = await insertProperty("9 Birch Ln", "Suburbia", "house", 615000, 4, "standard");
  const parkTower = await insertProperty("200 Park Tower", "Downtown", "penthouse", 1450000, 3, "upgrade");
  const lakeview = await insertProperty("78 Lakeview Dr", "Lakeside", "house", 980000, 5, "upgrade");
  const elm = await insertProperty("12 Elm Ct", "Downtown", "condo", 265000, 1, "standard");

  const histories: Record<string, number[]> = {
    [maple]: [430000, 445000, 462000, 480000],
    [oak]: [275000, 288000, 299000, 310000],
    [birch]: [560000, 578000, 595000, 615000],
    [parkTower]: [1200000, 1290000, 1370000, 1450000],
    [lakeview]: [820000, 870000, 925000, 980000],
    [elm]: [240000, 248000, 256000, 265000],
  };
  for (const [propertyId, prices] of Object.entries(histories)) {
    for (let i = 0; i < prices.length; i++) {
      await db.query("INSERT INTO property_price_history (property_id, year, avg_price) VALUES ($1, $2, $3)", [
        propertyId,
        CURRENT_YEAR - (prices.length - 1 - i),
        prices[i],
      ]);
    }
  }

  return {
    leads: { alice, bob, carol, dave, erin, frank, grace, henry },
    properties: { maple, oak, birch, parkTower, lakeview, elm },
  };
}

async function main() {
  const db = getDb();
  await ready();
  const ids = await seedDatabase(db);
  console.log(`Seeded database. Lead ids:`, ids.leads);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
