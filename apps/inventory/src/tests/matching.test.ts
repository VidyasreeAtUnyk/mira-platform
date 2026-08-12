import { randomUUID } from "node:crypto";
import type { Test } from "./testHelpers.js";
import { assertTrue, assertEqual, createTestDb } from "./testHelpers.js";
import { createDeveloperPartner, createInventoryUnit } from "../db/queries.js";
import { findMatchingInventory, matchAllWarmLeads } from "../domain/matching.js";
import type { Db } from "../db/types.js";

async function seedLead(
  db: Db,
  overrides: Partial<{
    name: string;
    budget_min: number | null;
    budget_max: number | null;
    property_interest: string | null;
    property_type: string | null;
    location_pref: string | null;
    preferred_areas: string[] | null;
    bedrooms: string | null;
    stage: string;
    do_not_contact: boolean;
  }> = {}
): Promise<string> {
  const id = randomUUID();
  const v = {
    name: "Test Lead",
    budget_min: null,
    budget_max: null,
    property_interest: null,
    property_type: null,
    location_pref: null,
    preferred_areas: null,
    bedrooms: null,
    stage: "new",
    do_not_contact: false,
    ...overrides,
  };
  await db.query(
    `INSERT INTO leads (id, name, phone, budget_min, budget_max, property_interest, property_type, location_pref, preferred_areas, bedrooms, stage, do_not_contact, source, segment, contact_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'test', 'prospect', 0)`,
    [
      id,
      v.name,
      `+1-555-${id.slice(0, 8)}`,
      v.budget_min,
      v.budget_max,
      v.property_interest,
      v.property_type,
      v.location_pref,
      v.preferred_areas,
      v.bedrooms,
      v.stage,
      v.do_not_contact,
    ]
  );
  return id;
}

export const matchingTests: Test[] = [
  {
    name: "findMatchingInventory: not_found for an id that isn't a lead at all",
    run: async () => {
      const db = await createTestDb();
      const result = await findMatchingInventory(db, randomUUID());
      assertEqual(result.status, "not_found", "unknown lead id should be not_found");
    },
  },
  {
    name: "findMatchingInventory: insufficient_profile when the lead has no budget/location/type signal",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedLead(db, { name: "Blank Profile" });
      const result = await findMatchingInventory(db, leadId);
      assertEqual(result.status, "insufficient_profile", "a lead with zero signal should refuse to guess");
    },
  },
  {
    name: "findMatchingInventory: budget alone is sufficient signal to attempt a match (not insufficient_profile)",
    run: async () => {
      const db = await createTestDb();
      const leadId = await seedLead(db, { budget_max: 1000000 });
      const result = await findMatchingInventory(db, leadId);
      assertTrue(result.status === "ok", "budget alone should be enough signal to proceed to 'ok'");
    },
  },
  {
    name: "findMatchingInventory: ok status returns units within budget, area, type, and bedroom filters",
    run: async () => {
      const db = await createTestDb();
      const partner = await createDeveloperPartner(db, { name: "Test Developer" });
      const inBudget = await createInventoryUnit(db, {
        developer_partner_id: partner.id,
        project_name: "In Budget Tower",
        property_type: "apartment",
        area: "Downtown",
        bedrooms: "2",
        price: 1000000,
        status: "available",
        source: "csv",
      });
      await createInventoryUnit(db, {
        developer_partner_id: partner.id,
        project_name: "Too Expensive Tower",
        property_type: "apartment",
        area: "Downtown",
        bedrooms: "2",
        price: 5000000,
        status: "available",
        source: "csv",
      });
      await createInventoryUnit(db, {
        developer_partner_id: partner.id,
        project_name: "Wrong Area Tower",
        property_type: "apartment",
        area: "Suburbia",
        bedrooms: "2",
        price: 1000000,
        status: "available",
        source: "csv",
      });
      await createInventoryUnit(db, {
        developer_partner_id: partner.id,
        project_name: "Sold Match Tower",
        property_type: "apartment",
        area: "Downtown",
        bedrooms: "2",
        price: 1000000,
        status: "sold", // not available -- must never surface
        source: "csv",
      });

      const leadId = await seedLead(db, {
        budget_max: 1000000,
        location_pref: "Downtown",
        property_type: "apartment",
        bedrooms: "2",
      });
      const result = await findMatchingInventory(db, leadId);
      assertTrue(result.status === "ok", "expected an ok result");
      if (result.status !== "ok") return;
      assertEqual(result.matches.length, 1, "only the in-budget, matching-area, available unit should match");
      assertEqual(result.matches[0].id, inBudget.id, "the matched unit should be the in-budget one");
    },
  },
  {
    name: "findMatchingInventory: a unit up to 10% over budget_max still surfaces, further over does not",
    run: async () => {
      const db = await createTestDb();
      const partner = await createDeveloperPartner(db, { name: "Headroom Developer" });
      const withinHeadroom = await createInventoryUnit(db, {
        developer_partner_id: partner.id,
        project_name: "Slightly Over Tower",
        price: 1080000, // 8% over a 1,000,000 budget_max
        status: "available",
        source: "csv",
      });
      const wayOver = await createInventoryUnit(db, {
        developer_partner_id: partner.id,
        project_name: "Way Over Tower",
        price: 1300000, // 30% over
        status: "available",
        source: "csv",
      });
      const leadId = await seedLead(db, { budget_max: 1000000 });
      const result = await findMatchingInventory(db, leadId);
      assertTrue(result.status === "ok", "expected ok");
      if (result.status !== "ok") return;
      const ids = result.matches.map((m) => m.id);
      assertTrue(ids.includes(withinHeadroom.id), "unit within 10% headroom should surface");
      assertTrue(!ids.includes(wayOver.id), "unit 30% over budget should not surface");
      assertEqual(result.matches.length, 1, "only the within-headroom unit should surface");
    },
  },
  {
    name: "matchAllWarmLeads: skips do_not_contact and lost/canceled/dormant leads even with full profiles",
    run: async () => {
      const db = await createTestDb();
      const partner = await createDeveloperPartner(db, { name: "Warm Leads Developer" });
      await createInventoryUnit(db, {
        developer_partner_id: partner.id,
        project_name: "Available Tower",
        area: "Downtown",
        price: 1000000,
        status: "available",
        source: "csv",
      });

      const warm = await seedLead(db, { name: "Warm Lead", budget_max: 1000000, location_pref: "Downtown", stage: "qualified" });
      await seedLead(db, { name: "DNC Lead", budget_max: 1000000, location_pref: "Downtown", stage: "qualified", do_not_contact: true });
      await seedLead(db, { name: "Lost Lead", budget_max: 1000000, location_pref: "Downtown", stage: "lost" });
      await seedLead(db, { name: "Dormant Lead", budget_max: 1000000, location_pref: "Downtown", stage: "dormant" });

      const results = await matchAllWarmLeads(db);
      assertEqual(results.length, 1, "only the single warm, matchable lead should appear");
      assertEqual(results[0].lead.id, warm, "the surfaced lead should be the warm one");
    },
  },
];
