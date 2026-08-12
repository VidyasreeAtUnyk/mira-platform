-- packages/shared-db/migrations/004_developer_inventory.sql
--
-- Additive migration for apps/inventory (SPEC.md module 4: Seller/Developer
-- Inventory). Written by the inventory-developer module branch
-- (claude/inventory-developer), NOT by Phase 0. Flagged prominently per
-- CLAUDE.md's module-boundary rule: this is a cross-module-relevant schema
-- change and should be reviewed as such.
--
-- Hard constraint: this file only ADDS tables. It does not alter, drop, or
-- rename anything in packages/shared-db/schema.sql (Phase 0's committed
-- schema) -- `leads`, `properties`, `agents`, etc. are untouched. Apply
-- after schema.sql (FKs below reference nothing in schema.sql directly, so
-- order only matters relative to schema.sql having created the
-- `uuid-ossp` extension and `update_updated_at_column()` trigger function,
-- both of which this file reuses rather than redefining).
--
-- Design note -- why NEW tables instead of extending `properties`
-- (see PROGRESS-inventory.md "Notes / decisions made" for the full version):
-- `properties` (schema.sql) is apps/crm's own curated listing set, matched
-- against leads via apps/lead-agent's findMatchingProperties. Developer
-- partner inventory is conceptually the same idea ("a property for sale")
-- but a genuinely different *source*: it arrives as an external feed
-- (CSV/paste/screenshot from a developer partner's own listings), is owned
-- by a specific developer_partners row, and carries fields `properties` has
-- no use for (project name, handover date, payment plan, MOU-governed
-- commission terms, raw ingestion provenance). Forcing it onto `properties`
-- would mean either bloating that table with developer-only columns that
-- are NULL for every CRM-owned row, or lossily dropping data on ingest.
-- Kept related-but-distinct, joined only at the matching layer
-- (apps/inventory/src/domain/matching.ts reads `leads` directly, the same
-- way findMatchingProperties does), not at the schema level.
--
-- Generic by construction (SPEC.md module 4's explicit requirement): no
-- table, column, or CHECK constraint below names a specific developer.
-- "Sobha" / "DAMAC" / any future partner are just rows in developer_partners.

-- ============================================================
-- developer_partners
-- ============================================================
create table if not exists developer_partners (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  -- Freeform summary of the deal ("3% on handover, net 30", "tiered by
  -- volume -- see MOU"). Structured renewal/exclusivity detail that changes
  -- over time lives in mou_terms below, not here -- this is a quick-glance
  -- default, not the source of truth for what's currently in force.
  commission_terms text,
  commission_rate numeric,
  status text not null default 'active' check (status in ('active', 'inactive', 'prospective')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_developer_partners_name on developer_partners (lower(name));

drop trigger if exists developer_partners_updated_at on developer_partners;
create trigger developer_partners_updated_at
  before update on developer_partners
  for each row execute function update_updated_at_column();

-- ============================================================
-- mou_terms (one row per MOU term/renewal period, per partner)
-- ============================================================
create table if not exists mou_terms (
  id uuid primary key default uuid_generate_v4(),
  developer_partner_id uuid not null references developer_partners(id) on delete cascade,
  term_start date not null,
  term_end date not null,
  commission_rate numeric,
  commission_notes text,
  exclusivity boolean not null default false,
  exclusivity_region text,
  -- Freeform target description ("24 units/yr", "AED 50M sales value") --
  -- deliberately not a structured numeric column: partner MOUs are not
  -- consistent about what they target (units vs. revenue vs. mix), and
  -- forcing one shape here would misrepresent MOUs that don't fit it.
  target_description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'renewed', 'terminated')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mou_terms_partner on mou_terms(developer_partner_id);
create index if not exists idx_mou_terms_term_end on mou_terms(term_end);

drop trigger if exists mou_terms_updated_at on mou_terms;
create trigger mou_terms_updated_at
  before update on mou_terms
  for each row execute function update_updated_at_column();

-- ============================================================
-- inventory_units (ingested developer inventory -- CSV/paste/screenshot)
-- ============================================================
create table if not exists inventory_units (
  id uuid primary key default uuid_generate_v4(),
  developer_partner_id uuid not null references developer_partners(id) on delete cascade,
  project_name text not null,
  unit_ref text,
  -- Freeform, not the `properties.type`/PROPERTY_TYPES enum on purpose --
  -- same reasoning as leads.property_interest vs leads.property_type
  -- (PROGRESS-phase0.md): vendor CSVs/screenshots use inconsistent
  -- vocabulary ("Apt", "1BR+Study", "Townhouse - Corner") that would lose
  -- information if forced onto a 5-value enum at ingest time.
  property_type text,
  bedrooms text,
  area text,
  price numeric,
  currency text not null default 'AED',
  size_sqft numeric,
  floor text,
  view text,
  handover_date date,
  payment_plan text,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold', 'on_hold')),
  -- Ingestion provenance -- required for a "no scraping" audit trail per
  -- CLAUDE.md: every row must be traceable to a manual/semi-manual action.
  source text not null default 'csv' check (source in ('csv', 'paste', 'screenshot', 'manual')),
  source_ref text,
  raw_data jsonb,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_units_partner on inventory_units(developer_partner_id);
create index if not exists idx_inventory_units_status on inventory_units(status);
create index if not exists idx_inventory_units_area on inventory_units(area);

drop trigger if exists inventory_units_updated_at on inventory_units;
create trigger inventory_units_updated_at
  before update on inventory_units
  for each row execute function update_updated_at_column();
