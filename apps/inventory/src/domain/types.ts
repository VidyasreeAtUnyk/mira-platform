/**
 * Row types for this module's tables (packages/shared-db/migrations/006_developer_inventory.sql).
 *
 * Kept local to apps/inventory rather than added to @mira/shared-types: the
 * task scope for this branch only carves out an exception to "don't touch
 * packages/*" for an *additive migration* under packages/shared-db (see
 * CLAUDE.md module-boundary rule + this branch's build instructions), not
 * for packages/shared-types. No other module reads these tables yet. If a
 * future module (e.g. dashboard, pipeline) needs to read developer
 * inventory, promoting these types to packages/shared-types is a
 * reasonable follow-up -- flagged in PROGRESS-inventory.md.
 */

export const DEVELOPER_PARTNER_STATUSES = ["active", "inactive", "prospective"] as const;
export type DeveloperPartnerStatus = (typeof DEVELOPER_PARTNER_STATUSES)[number];

export const MOU_STATUSES = ["draft", "active", "expired", "renewed", "terminated"] as const;
export type MouStatus = (typeof MOU_STATUSES)[number];

export const INVENTORY_UNIT_STATUSES = ["available", "reserved", "sold", "on_hold"] as const;
export type InventoryUnitStatus = (typeof INVENTORY_UNIT_STATUSES)[number];

export const INVENTORY_SOURCES = ["csv", "paste", "screenshot", "manual"] as const;
export type InventorySource = (typeof INVENTORY_SOURCES)[number];

export interface DeveloperPartner {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  commission_terms: string | null;
  commission_rate: number | null;
  status: DeveloperPartnerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDeveloperPartnerInput {
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  commission_terms?: string;
  commission_rate?: number;
  status?: DeveloperPartnerStatus;
  notes?: string;
}

export interface MouTerm {
  id: string;
  developer_partner_id: string;
  term_start: string;
  term_end: string;
  commission_rate: number | null;
  commission_notes: string | null;
  exclusivity: boolean;
  exclusivity_region: string | null;
  target_description: string | null;
  status: MouStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMouTermInput {
  developer_partner_id: string;
  term_start: string;
  term_end: string;
  commission_rate?: number;
  commission_notes?: string;
  exclusivity?: boolean;
  exclusivity_region?: string;
  target_description?: string;
  status?: MouStatus;
  notes?: string;
}

export interface InventoryUnit {
  id: string;
  developer_partner_id: string;
  project_name: string;
  unit_ref: string | null;
  property_type: string | null;
  bedrooms: string | null;
  area: string | null;
  price: number | null;
  currency: string;
  size_sqft: number | null;
  floor: string | null;
  view: string | null;
  handover_date: string | null;
  payment_plan: string | null;
  status: InventoryUnitStatus;
  source: InventorySource;
  source_ref: string | null;
  raw_data: unknown;
  ingested_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryUnitInput {
  developer_partner_id: string;
  project_name: string;
  unit_ref?: string;
  property_type?: string;
  bedrooms?: string;
  area?: string;
  price?: number;
  currency?: string;
  size_sqft?: number;
  floor?: string;
  view?: string;
  handover_date?: string;
  payment_plan?: string;
  status?: InventoryUnitStatus;
  source: InventorySource;
  source_ref?: string;
  raw_data?: unknown;
}

/** Outcome of one CSV/paste ingestion run -- surfaced to the CLI and logged to the shared audit_log table. */
export interface IngestionResult {
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: IngestionRowError[];
}

export interface IngestionRowError {
  row: number;
  message: string;
}
