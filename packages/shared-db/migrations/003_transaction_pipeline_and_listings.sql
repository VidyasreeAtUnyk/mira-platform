-- packages/shared-db/migrations/003_transaction_pipeline_and_listings.sql
--
-- Additive migration for apps/pipeline (Transaction Pipeline + Listing
-- Management, SPEC.md modules 2 & 3). Per CLAUDE.md's module-boundary rule
-- this does NOT touch Phase 0's schema.sql tables/migrations -- it only adds
-- new columns (via ADD COLUMN IF NOT EXISTS) and new tables (via CREATE
-- TABLE IF NOT EXISTS), so it is safe to apply on top of an already-running
-- schema.sql database and safe to re-run (idempotent, same pattern as
-- schema.sql itself). MUST be applied AFTER packages/shared-db/schema.sql
-- (it references leads, agents, properties, and reuses the
-- update_updated_at_column() trigger function schema.sql defines).
--
-- Cross-module note (flagging per CLAUDE.md -- a shared-schema addition,
-- not an apps/pipeline-local concern): this adds columns to the existing
-- shared `properties` table and one new shared table
-- (`listing_price_changes`). Any other module reading/writing `properties`
-- (e.g. apps/inventory, apps/crm's intelligence page) should be aware these
-- now exist. Nothing here modifies existing columns/rows' meaning.
--
-- IMPORTANT -- do not confuse `listing_price_changes` (new, below) with the
-- existing `property_price_history` table in schema.sql. They look similar
-- but are different concepts:
--   * `property_price_history` (Phase 0, unchanged): {property_id, year,
--     avg_price} -- an annual MARKET INDEX figure for a property's
--     type/area, used by apps/lead-agent for comps/matching. Not a
--     per-listing event log; there is no `changed_at` and no notion of
--     "this specific unit was reduced from X to Y".
--   * `listing_price_changes` (new, this migration): a per-LISTING event
--     log of actual asking-price changes on one specific property row
--     (list price cut from AED 2.4M to AED 2.3M on 2026-03-01, with a
--     timestamp and optional reason). This is what SPEC.md module 3 ("price
--     changes") means. See PROGRESS-pipeline.md Notes for the full
--     reasoning -- this was not obvious from the table name alone.

-- ============================================================
-- properties: add listing-management columns (status, DOM inputs)
-- ============================================================
-- Additive only. Existing rows backfill to 'active' + listed_at = now() on
-- migration, which is a reasonable default for pre-existing inventory rows
-- (their real listing date is unknown) -- flagged in PROGRESS-pipeline.md.
alter table properties
  add column if not exists status text not null default 'active'
    check (status in ('active', 'pending', 'under_offer', 'sold', 'withdrawn', 'expired'));

alter table properties
  add column if not exists listed_at timestamptz not null default now();

alter table properties
  add column if not exists sold_at timestamptz;

alter table properties
  add column if not exists withdrawn_at timestamptz;

alter table properties
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_properties_status on properties(status);

-- Reuses update_updated_at_column() defined in packages/shared-db/schema.sql.
drop trigger if exists properties_updated_at on properties;
create trigger properties_updated_at
  before update on properties
  for each row execute function update_updated_at_column();

-- ============================================================
-- listing_price_changes (per-listing asking-price event log)
-- ============================================================
create table if not exists listing_price_changes (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  old_price numeric,
  new_price numeric not null,
  reason text,
  changed_by uuid references agents(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_listing_price_changes_property on listing_price_changes(property_id, changed_at);

-- ============================================================
-- transactions (the transaction-pipeline deal record -- SPEC.md module 2)
--
-- Distinct from `leads` (raw CRM lead / lead-agent funnel, see
-- packages/shared-types/src/stage.ts): a transaction only exists once a
-- lead has progressed to an actual deal in motion against a specific
-- property. See PROGRESS-pipeline.md Notes for the full pipeline-stage-vs-
-- lead-stage reasoning.
-- ============================================================
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references leads(id) on delete restrict,
  property_id uuid references properties(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  stage text not null default 'showing' check (stage in (
    'showing', 'offer', 'under_contract', 'inspection', 'closing',
    'closed_won', 'closed_lost'
  )),
  offer_price numeric,
  contract_price numeric,
  expected_closing_date date,
  closed_at timestamptz,
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_lead on transactions(lead_id);
create index if not exists idx_transactions_property on transactions(property_id);
create index if not exists idx_transactions_stage on transactions(stage);

drop trigger if exists transactions_updated_at on transactions;
create trigger transactions_updated_at
  before update on transactions
  for each row execute function update_updated_at_column();

-- ============================================================
-- transaction_stage_history (audit trail of pipeline-stage transitions)
-- ============================================================
create table if not exists transaction_stage_history (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references agents(id) on delete set null,
  note text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_transaction_stage_history_txn on transaction_stage_history(transaction_id, changed_at);
