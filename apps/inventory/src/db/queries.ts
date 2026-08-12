import type { Db } from "./types.js";
import { nowIso } from "./client.js";
import type {
  DeveloperPartner,
  CreateDeveloperPartnerInput,
  MouTerm,
  CreateMouTermInput,
  InventoryUnit,
  CreateInventoryUnitInput,
} from "../domain/types.js";

// ============================================================
// developer_partners
// ============================================================

export async function createDeveloperPartner(db: Db, input: CreateDeveloperPartnerInput): Promise<DeveloperPartner> {
  const result = await db.query<DeveloperPartner>(
    `INSERT INTO developer_partners
       (name, contact_name, contact_email, contact_phone, commission_terms, commission_rate, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.name,
      input.contact_name ?? null,
      input.contact_email ?? null,
      input.contact_phone ?? null,
      input.commission_terms ?? null,
      input.commission_rate ?? null,
      input.status ?? "active",
      input.notes ?? null,
    ]
  );
  return result.rows[0];
}

export async function getDeveloperPartner(db: Db, id: string): Promise<DeveloperPartner | undefined> {
  const result = await db.query<DeveloperPartner>("SELECT * FROM developer_partners WHERE id = $1", [id]);
  return result.rows[0];
}

/** Case-insensitive exact-name lookup -- used by CSV ingestion to resolve a `--partner` CLI arg that isn't a UUID. */
export async function getDeveloperPartnerByName(db: Db, name: string): Promise<DeveloperPartner | undefined> {
  const result = await db.query<DeveloperPartner>("SELECT * FROM developer_partners WHERE lower(name) = lower($1)", [
    name,
  ]);
  return result.rows[0];
}

export async function listDeveloperPartners(db: Db): Promise<DeveloperPartner[]> {
  const result = await db.query<DeveloperPartner>("SELECT * FROM developer_partners ORDER BY name ASC");
  return result.rows;
}

export async function updateDeveloperPartner(
  db: Db,
  id: string,
  patch: Partial<CreateDeveloperPartnerInput>
): Promise<DeveloperPartner | undefined> {
  const keys = Object.keys(patch);
  if (keys.length === 0) return getDeveloperPartner(db, id);
  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = keys.map((k) => (patch as Record<string, unknown>)[k]);
  const result = await db.query<DeveloperPartner>(
    `UPDATE developer_partners SET ${setClause} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0];
}

// ============================================================
// mou_terms
// ============================================================

export async function createMouTerm(db: Db, input: CreateMouTermInput): Promise<MouTerm> {
  const result = await db.query<MouTerm>(
    `INSERT INTO mou_terms
       (developer_partner_id, term_start, term_end, commission_rate, commission_notes,
        exclusivity, exclusivity_region, target_description, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.developer_partner_id,
      input.term_start,
      input.term_end,
      input.commission_rate ?? null,
      input.commission_notes ?? null,
      input.exclusivity ?? false,
      input.exclusivity_region ?? null,
      input.target_description ?? null,
      input.status ?? "draft",
      input.notes ?? null,
    ]
  );
  return result.rows[0];
}

export async function getMouTerm(db: Db, id: string): Promise<MouTerm | undefined> {
  const result = await db.query<MouTerm>("SELECT * FROM mou_terms WHERE id = $1", [id]);
  return result.rows[0];
}

export async function listMouTerms(db: Db, developerPartnerId?: string): Promise<MouTerm[]> {
  if (developerPartnerId) {
    const result = await db.query<MouTerm>(
      "SELECT * FROM mou_terms WHERE developer_partner_id = $1 ORDER BY term_end ASC",
      [developerPartnerId]
    );
    return result.rows;
  }
  const result = await db.query<MouTerm>("SELECT * FROM mou_terms ORDER BY term_end ASC");
  return result.rows;
}

/** MOU terms with status in ('draft','active') whose term_end falls within [today, today+withinDays]. */
export async function listMousExpiringSoon(db: Db, withinDays: number): Promise<MouTerm[]> {
  const result = await db.query<MouTerm>(
    `SELECT * FROM mou_terms
     WHERE status IN ('draft', 'active')
       AND term_end >= CURRENT_DATE
       AND term_end <= CURRENT_DATE + ($1 || ' days')::interval
     ORDER BY term_end ASC`,
    [withinDays]
  );
  return result.rows;
}

/** MOU terms already past term_end but still marked draft/active -- compliance gap: renew, terminate, or mark expired. */
export async function listMousOverdue(db: Db): Promise<MouTerm[]> {
  const result = await db.query<MouTerm>(
    `SELECT * FROM mou_terms
     WHERE status IN ('draft', 'active') AND term_end < CURRENT_DATE
     ORDER BY term_end ASC`
  );
  return result.rows;
}

export async function updateMouTermStatus(db: Db, id: string, status: MouTerm["status"]): Promise<MouTerm | undefined> {
  const result = await db.query<MouTerm>("UPDATE mou_terms SET status = $2 WHERE id = $1 RETURNING *", [id, status]);
  return result.rows[0];
}

// ============================================================
// inventory_units
// ============================================================

export async function createInventoryUnit(db: Db, input: CreateInventoryUnitInput): Promise<InventoryUnit> {
  const result = await db.query<InventoryUnit>(
    `INSERT INTO inventory_units
       (developer_partner_id, project_name, unit_ref, property_type, bedrooms, area, price, currency,
        size_sqft, floor, view, handover_date, payment_plan, status, source, source_ref, raw_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      input.developer_partner_id,
      input.project_name,
      input.unit_ref ?? null,
      input.property_type ?? null,
      input.bedrooms ?? null,
      input.area ?? null,
      input.price ?? null,
      input.currency ?? "AED",
      input.size_sqft ?? null,
      input.floor ?? null,
      input.view ?? null,
      input.handover_date ?? null,
      input.payment_plan ?? null,
      input.status ?? "available",
      input.source,
      input.source_ref ?? null,
      input.raw_data === undefined ? null : JSON.stringify(input.raw_data),
    ]
  );
  return result.rows[0];
}

export async function getInventoryUnit(db: Db, id: string): Promise<InventoryUnit | undefined> {
  const result = await db.query<InventoryUnit>("SELECT * FROM inventory_units WHERE id = $1", [id]);
  return result.rows[0];
}

export async function listInventoryUnits(
  db: Db,
  filter?: { developer_partner_id?: string; status?: InventoryUnit["status"] }
): Promise<InventoryUnit[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filter?.developer_partner_id) {
    values.push(filter.developer_partner_id);
    conditions.push(`developer_partner_id = $${values.length}`);
  }
  if (filter?.status) {
    values.push(filter.status);
    conditions.push(`status = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.query<InventoryUnit>(
    `SELECT * FROM inventory_units ${where} ORDER BY created_at DESC, id`,
    values
  );
  return result.rows;
}

/** Only units still on the market -- what buyer-demand matching should ever suggest. */
export async function listAvailableInventoryUnits(db: Db): Promise<InventoryUnit[]> {
  return listInventoryUnits(db, { status: "available" });
}

// ============================================================
// audit_log (reused from packages/shared-db/schema.sql -- see PROGRESS-inventory.md
// Notes for why ingestion logging piggybacks on the existing shared table
// instead of a new one).
// ============================================================

export async function logIngestionAudit(
  db: Db,
  input: { toolName: string; inputJson: unknown; outputJson: unknown; actor: "agent" | "human" }
): Promise<void> {
  await db.query(
    `INSERT INTO audit_log (lead_id, tool_name, input_json, output_json, actor, created_at)
     VALUES (NULL, $1, $2, $3, $4, $5)`,
    [input.toolName, JSON.stringify(input.inputJson), JSON.stringify(input.outputJson), input.actor, nowIso()]
  );
}

// ============================================================
// leads (read-only -- shared table, owned by Phase 0/CRM/lead-agent)
// ============================================================

/**
 * Minimal shape this module needs off `leads` for buyer-demand matching.
 * Deliberately not importing the full @mira/shared-types `Lead` interface
 * for a `SELECT *` -- selecting just the matching-relevant columns makes
 * the query's data dependency explicit and keeps this read-only consumer
 * decoupled from unrelated Lead columns changing shape later.
 */
export interface MatchableLead {
  id: string;
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
}

export async function getMatchableLead(db: Db, leadId: string): Promise<MatchableLead | undefined> {
  const result = await db.query<MatchableLead>(
    `SELECT id, name, budget_min, budget_max, property_interest, property_type, location_pref,
            preferred_areas, bedrooms, stage, do_not_contact
     FROM leads WHERE id = $1`,
    [leadId]
  );
  return result.rows[0];
}

/** Warm leads = actively in the funnel, not lost/canceled/dormant/do-not-contact -- the pool worth matching against inventory. */
export async function listWarmLeads(db: Db): Promise<MatchableLead[]> {
  const result = await db.query<MatchableLead>(
    `SELECT id, name, budget_min, budget_max, property_interest, property_type, location_pref,
            preferred_areas, bedrooms, stage, do_not_contact
     FROM leads
     WHERE do_not_contact = false
       AND stage NOT IN ('lost', 'canceled', 'dormant')
     ORDER BY created_at DESC`
  );
  return result.rows;
}
