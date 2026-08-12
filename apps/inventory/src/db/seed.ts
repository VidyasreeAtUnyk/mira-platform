import { fileURLToPath } from "node:url";
import type { Db } from "./types.js";
import { getDb, ready } from "./client.js";
import {
  createDeveloperPartner,
  createMouTerm,
  createInventoryUnit,
} from "./queries.js";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface SeedIds {
  partners: { sobha: string; damac: string; emaar: string };
  leads: { fatima: string; omar: string; priya: string };
}

/**
 * Inserts a full dev/demo dataset for apps/inventory: developer partners
 * (varied status), MOU terms (deliberately covering overdue, expiring-soon,
 * in-force, and not-yet-active so `mou-expiring`/`mou-overdue` have real
 * rows to show), inventory units spread across areas/types/budgets so
 * matching has something to find, and a small set of demo leads with
 * varying profile completeness.
 *
 * Only this module's own tables (developer_partners, mou_terms,
 * inventory_units) are wiped first -- `leads` is a shared, Phase-0-owned
 * table apps/inventory only reads from; it's appended to here (three
 * `Inventory-Seed` prefixed rows, upserted by phone so re-running `npm run
 * seed` doesn't duplicate them), never truncated. See src/db/reset.ts for
 * the same boundary.
 */
export async function seedDatabase(db: Db): Promise<SeedIds> {
  await db.query("TRUNCATE inventory_units, mou_terms, developer_partners CASCADE");

  const sobha = await createDeveloperPartner(db, {
    name: "Sobha Realty",
    contact_name: "Anita Rao",
    contact_email: "anita.rao@sobha-partners.example",
    contact_phone: "+971-50-100-2001",
    commission_terms: "3% on handover, net 30",
    commission_rate: 3,
    status: "active",
    notes: "Primary channel partner contact, Dubai Hills desk.",
  });

  const damac = await createDeveloperPartner(db, {
    name: "DAMAC Properties",
    contact_name: "Youssef Haddad",
    contact_email: "agents.crm@damacproperties.example",
    contact_phone: "+971-50-100-2002",
    commission_terms: "Tiered by volume -- see MOU",
    commission_rate: 2.5,
    status: "active",
    notes: "DAMAC Agents Portal login stays with the human agent -- CSV export only, per CLAUDE.md.",
  });

  const emaar = await createDeveloperPartner(db, {
    name: "Emaar Properties",
    contact_name: "Lina Chebli",
    contact_email: "lina.chebli@emaar-partners.example",
    contact_phone: "+971-50-100-2003",
    status: "prospective",
    notes: "Early conversations only -- no MOU signed yet.",
  });

  // MOU terms -- one of each urgency bucket so the compliance views have real data.
  await createMouTerm(db, {
    developer_partner_id: sobha.id,
    term_start: daysAgo(400),
    term_end: daysAgo(20), // overdue: past end date, still 'active'
    commission_rate: 3,
    exclusivity: false,
    target_description: "24 units/yr",
    status: "active",
    notes: "Needs renewal or termination decision -- overdue.",
  });

  await createMouTerm(db, {
    developer_partner_id: damac.id,
    term_start: daysAgo(300),
    term_end: daysFromNow(30), // expiring soon (within default 60-day window)
    commission_rate: 2.5,
    exclusivity: true,
    exclusivity_region: "Business Bay",
    target_description: "AED 50M sales value/yr",
    status: "active",
    notes: "Exclusive on Business Bay launches -- renewal conversation due.",
  });

  await createMouTerm(db, {
    developer_partner_id: sobha.id,
    term_start: daysAgo(10),
    term_end: daysFromNow(355), // comfortably in force
    commission_rate: 3.5,
    exclusivity: false,
    target_description: "Renewed 2026 term",
    status: "active",
    notes: "Most recent renewal, replaces the overdue term above going forward.",
  });

  await createMouTerm(db, {
    developer_partner_id: emaar.id,
    term_start: daysFromNow(15), // not yet active
    term_end: daysFromNow(380),
    commission_rate: 2,
    exclusivity: false,
    target_description: "Pilot term pending signature",
    status: "draft",
    notes: "Draft only -- awaiting signed MOU.",
  });

  // Inventory units -- spread across areas/types/budgets/bedrooms so
  // findMatchingInventory/matchAllWarmLeads have real candidates to filter.
  const units: Array<Parameters<typeof createInventoryUnit>[1]> = [
    {
      developer_partner_id: sobha.id,
      project_name: "Sobha Hartland II",
      unit_ref: "SH2-1204",
      property_type: "apartment",
      bedrooms: "2",
      area: "Sobha Hartland",
      price: 2100000,
      currency: "AED",
      size_sqft: 1180,
      floor: "12",
      view: "lagoon",
      handover_date: "2027-06-30",
      payment_plan: "60/40",
      status: "available",
      source: "csv",
      source_ref: "seed-fixture",
    },
    {
      developer_partner_id: sobha.id,
      project_name: "Sobha One",
      unit_ref: "S1-0805",
      property_type: "apartment",
      bedrooms: "1",
      area: "Ras Al Khor",
      price: 1350000,
      currency: "AED",
      size_sqft: 780,
      floor: "8",
      view: "creek",
      handover_date: "2026-12-31",
      payment_plan: "80/20",
      status: "available",
      source: "csv",
      source_ref: "seed-fixture",
    },
    {
      developer_partner_id: damac.id,
      project_name: "DAMAC Bay 2",
      unit_ref: "DB2-2101",
      property_type: "apartment",
      bedrooms: "2",
      area: "Business Bay",
      price: 2600000,
      currency: "AED",
      size_sqft: 1250,
      floor: "21",
      view: "canal",
      handover_date: "2027-03-31",
      payment_plan: "70/30",
      status: "available",
      source: "csv",
      source_ref: "seed-fixture",
    },
    {
      developer_partner_id: damac.id,
      project_name: "DAMAC Lagoons",
      unit_ref: "DL-VILLA-45",
      property_type: "villa",
      bedrooms: "4+",
      area: "Damac Lagoons",
      price: 4200000,
      currency: "AED",
      size_sqft: 3400,
      view: "lagoon",
      handover_date: "2026-09-30",
      payment_plan: "60/40",
      status: "reserved",
      source: "paste",
      source_ref: "seed-fixture",
    },
    {
      developer_partner_id: damac.id,
      project_name: "DAMAC Sun City",
      unit_ref: "SC-0912",
      property_type: "townhouse",
      bedrooms: "3",
      area: "Dubailand",
      price: 1950000,
      currency: "AED",
      size_sqft: 2100,
      view: "community",
      handover_date: "2028-01-31",
      payment_plan: "1% monthly",
      status: "available",
      source: "csv",
      source_ref: "seed-fixture",
    },
    {
      developer_partner_id: sobha.id,
      project_name: "Sobha Hartland II",
      unit_ref: "SH2-2210",
      property_type: "apartment",
      bedrooms: "3",
      area: "Sobha Hartland",
      price: 3400000,
      currency: "AED",
      size_sqft: 1750,
      floor: "22",
      view: "lagoon",
      handover_date: "2027-06-30",
      payment_plan: "60/40",
      status: "sold",
      source: "csv",
      source_ref: "seed-fixture",
    },
  ];
  for (const unit of units) {
    await createInventoryUnit(db, unit);
  }

  // Demo leads -- deliberately varying profile completeness so `match`
  // exercises insufficient_profile / ok with real data. Upserted by phone
  // (leads has no unique name constraint) so re-running seed doesn't
  // duplicate; `leads` itself is never truncated here (shared, not owned --
  // see this function's doc comment).
  async function upsertLead(input: {
    name: string;
    phone: string;
    property_interest: string | null;
    property_type: string | null;
    budget_min: number | null;
    budget_max: number | null;
    location_pref: string | null;
    preferred_areas: string[] | null;
    bedrooms: string | null;
    stage: string;
  }): Promise<string> {
    const existing = await db.query<{ id: string }>("SELECT id FROM leads WHERE phone = $1", [input.phone]);
    if (existing.rows[0]) return existing.rows[0].id;
    const result = await db.query<{ id: string }>(
      `INSERT INTO leads
        (name, phone, property_interest, property_type, budget_min, budget_max, location_pref, preferred_areas, bedrooms, stage, source, segment, do_not_contact, contact_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'inventory_seed', 'prospect', false, 0)
       RETURNING id`,
      [
        input.name,
        input.phone,
        input.property_interest,
        input.property_type,
        input.budget_min,
        input.budget_max,
        input.location_pref,
        input.preferred_areas,
        input.bedrooms,
        input.stage,
      ]
    );
    return result.rows[0].id;
  }

  // Fatima: well-specified buyer -- should match Sobha Hartland II 2BR.
  const fatima = await upsertLead({
    name: "Inventory-Seed Lead: Fatima Al Zaabi",
    phone: "+971-50-900-3001",
    property_interest: "apartment",
    property_type: "apartment",
    budget_min: 1800000,
    budget_max: 2200000,
    location_pref: "Sobha Hartland",
    preferred_areas: ["Sobha Hartland"],
    bedrooms: "2",
    stage: "qualified",
  });

  // Omar: budget + area but no property type -- broader match set expected.
  const omar = await upsertLead({
    name: "Inventory-Seed Lead: Omar Nasser",
    phone: "+971-50-900-3002",
    property_interest: null,
    property_type: null,
    budget_min: null,
    budget_max: 2800000,
    location_pref: "Business Bay",
    preferred_areas: ["Business Bay"],
    bedrooms: null,
    stage: "contacted",
  });

  // Priya: no budget/location/type signal at all -- insufficient_profile case.
  const priya = await upsertLead({
    name: "Inventory-Seed Lead: Priya Sharma",
    phone: "+971-50-900-3003",
    property_interest: null,
    property_type: null,
    budget_min: null,
    budget_max: null,
    location_pref: null,
    preferred_areas: null,
    bedrooms: null,
    stage: "new",
  });

  return { partners: { sobha: sobha.id, damac: damac.id, emaar: emaar.id }, leads: { fatima, omar, priya } };
}

async function main() {
  const db = getDb();
  await ready();
  const ids = await seedDatabase(db);
  console.log("Seeded database.");
  console.log("Developer partner ids:", ids.partners);
  console.log("Demo lead ids:", ids.leads);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
