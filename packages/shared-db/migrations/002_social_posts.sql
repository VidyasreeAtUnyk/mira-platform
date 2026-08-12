-- packages/shared-db/migrations/002_social_posts.sql
--
-- Post-Phase-0 addition, added by the apps/social-assistant module build
-- (SPEC.md module 7, "Social Media Assistant"). Kept as a separate,
-- clearly-labelled migration file rather than edited into schema.sql
-- directly, per CLAUDE.md's module-boundary rule -- ADDITIVE ONLY: creates
-- two new tables, touches nothing schema.sql already defines.
--
-- Why this lives in packages/shared-db (shared) instead of staying
-- apps/social-assistant-local (apps/social-assistant/db/schema.sql, which
-- originally drafted these two tables alongside its own genuinely-local
-- ones -- see that file's current header for the full split):
--   * SPEC.md module 2 (Dashboard / "Today view") -- "nearly everything
--     routes here at launch" via the review/approval queue; pending-approval
--     social posts are exactly that kind of item.
--   * SPEC.md module 11 (Monthly report) rolls up "marketing ROI", which
--     reads social_posts (what ran/is queued) and social_post_metrics
--     (performance, once a real posting integration exists).
-- Nothing else in the schema needs to change to support that: social_posts
-- references the existing shared `properties` table by id, same as every
-- other shared table.
--
-- Deliberately NOT promoted here (stay apps/social-assistant-local, see
-- apps/social-assistant/db/schema.sql): `listing_marketing_details` (a
-- `properties` sidecar pending a real fold-in decision -- no other module
-- reads it yet), `developer_brand_profiles` (a lightweight compliance
-- placeholder pending SPEC.md module 4's real developer partner directory --
-- deliberately NOT given a shared home so it doesn't become load-bearing
-- before module 4 exists), and `ai_call_log` (internal budget-governor
-- bookkeeping for this module only, same category as apps/lead-agent's
-- app-local run_state/run_metrics per packages/shared-db/schema.sql's header
-- comment).
--
-- Because `developer_brand_profiles` stays app-local, `social_posts.
-- developer_partner_name` is plain text here, NOT a foreign key (an
-- apps/social-assistant-local table cannot be referenced from a shared
-- migration without breaking module boundaries the other direction).
-- apps/social-assistant's own data-access layer (src/lib/data/posts.ts)
-- still enforces brand-mode consistency at the application layer, mirroring
-- the CHECK constraint below.
--
-- Apply order: this file assumes packages/shared-db/schema.sql has already
-- been applied to the target database.
--
-- Local dev/test:
--   psql mira_dev -f packages/shared-db/schema.sql
--   psql mira_dev -f packages/shared-db/migrations/002_social_posts.sql
--   psql mira_dev -f apps/social-assistant/db/schema.sql   -- app-local tables (ai_call_log FKs into social_posts, so this must run last)
--
-- Supabase (production) apply path: not yet applied to any real Supabase
-- project -- no live Supabase credentials exist in this environment (see
-- PROGRESS-social.md Blockers). When one exists, mirror this DDL as an
-- apps/crm-style numbered Supabase migration, same pattern as
-- apps/crm/supabase/migrations/004_shared_schema_merge.sql did for Phase 0.

create extension if not exists "uuid-ossp";

-- ============================================================
-- social_posts (content calendar)
-- Draft-and-hold only -- status never reaches anything resembling
-- "posted"/"published" because there is no live posting integration.
-- ============================================================
create table if not exists social_posts (
  id uuid primary key default uuid_generate_v4(),
  kind text not null check (kind in ('new_listing', 'price_update', 'sold', 'market_update', 'brand_general')),
  platform text not null check (platform in ('instagram', 'facebook', 'linkedin', 'tiktok', 'google_business')),
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'held')),
  brand_mode text not null default 'own' check (brand_mode in ('own', 'co_branded')),
  -- Plain text, not an FK -- see header note (developer_brand_profiles stays app-local).
  developer_partner_name text,
  property_id uuid references properties(id) on delete set null,
  caption text not null default '',
  caption_source text not null default 'template' check (caption_source in ('template', 'ai')),
  scheduled_for timestamptz,
  -- Free text pending real RBAC (SPEC.md's 6-row RBAC table hasn't landed in
  -- the shared schema; see apps/social-assistant's local ViewerRole type).
  created_by_role text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- co_branded posts must name the developer; own-branded posts must not.
  constraint social_posts_brand_mode_consistency check (
    (brand_mode = 'co_branded' and developer_partner_name is not null)
    or (brand_mode = 'own' and developer_partner_name is null)
  )
);

create index if not exists idx_social_posts_status on social_posts(status);
create index if not exists idx_social_posts_scheduled on social_posts(scheduled_for);
create index if not exists idx_social_posts_property on social_posts(property_id);

create or replace function update_social_posts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists social_posts_updated_at on social_posts;
create trigger social_posts_updated_at
  before update on social_posts
  for each row execute function update_social_posts_updated_at();

-- ============================================================
-- social_post_metrics (performance monitoring -- stub/structure only)
-- No live posting integration exists yet, so nothing writes real rows here
-- today. `source` exists precisely so a future real ingestion
-- ('platform_api') is distinguishable from anything else -- this module
-- must never fabricate numbers into this table. See
-- apps/social-assistant/src/lib/data/metrics.ts.
-- ============================================================
create table if not exists social_post_metrics (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references social_posts(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'linkedin', 'tiktok', 'google_business')),
  metric_type text not null check (metric_type in ('impressions', 'reach', 'likes', 'comments', 'shares', 'saves', 'link_clicks')),
  value numeric not null,
  source text not null check (source in ('platform_api', 'manual_entry')),
  recorded_at timestamptz not null default now()
);

create index if not exists idx_social_post_metrics_post on social_post_metrics(post_id);
