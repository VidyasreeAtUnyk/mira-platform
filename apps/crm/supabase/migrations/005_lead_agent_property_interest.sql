-- Migration 005: lead-agent's free-text property interest
--
-- Gap found while migrating apps/lead-agent onto the shared schema (migration
-- 004): apps/lead-agent's fixture/demo data describes what a lead is looking
-- for as free text ("house", "condo", "studio apartment", "penthouse") that
-- doesn't parse onto apps/crm's `property_type` enum (apartment/villa/
-- townhouse/commercial/land) -- neither the values nor the granularity match.
-- Rather than force lead-agent's discovery-stage text through a structured
-- enum it was never designed against, `property_interest` gets its own
-- column, the same way `location_pref`/`timeline` were kept alongside
-- `preferred_areas` in migration 004: two representations of a similar idea,
-- one structured (property_type, for CRM's own leads), one freeform
-- (property_interest, for lead-agent's discovery-stage leads), because
-- forcing one onto the other during a schema merge would silently lose
-- information. See PROGRESS-phase0.md.

alter table leads
  add column if not exists property_interest text;
