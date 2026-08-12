-- apps/social-assistant/db/schema.sql
--
-- App-local additive schema for the social media assistant module. This is
-- NOT part of packages/shared-db -- per CLAUDE.md's module-boundary rules
-- and this session's explicit instruction not to touch packages/* while
-- six module agents build in parallel off the same phase0-complete base,
-- these tables live app-local, the same way apps/lead-agent keeps its own
-- run_state/run_metrics tables app-local (see packages/shared-db/schema.sql
-- header comment for that precedent).
--
-- Assumes it applies to the SAME Postgres database as
-- packages/shared-db/schema.sql (foreign keys reference `properties` and
-- `agents` there). Run shared-db's schema.sql first.
--
-- Flagged for the integration pass (scripts/integration.sh): consider
-- folding `listing_marketing_details` fields into the shared `properties`
-- table, and reconciling `developer_brand_profiles` with module 4's
-- (Seller/Developer Inventory) developer partner directory once it exists,
-- rather than keeping two developer-facing tables long-term.

create extension if not exists "uuid-ossp";

-- ============================================================
-- listing_marketing_details
-- Additive sidecar for shared `properties` rows: fields the poster
-- generator needs that packages/shared-db's `properties` table doesn't
-- carry yet (bathrooms, community, developer partner, listing title, a
-- photo). One-to-one with a `properties` row.
-- ============================================================
create table if not exists listing_marketing_details (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null unique references properties(id) on delete cascade,
  bathrooms integer,
  community_name text,
  developer_partner_name text,
  listing_title text,
  -- Reference to a photo (URL or storage path). No photo library exists yet
  -- (BRAND-KIT.md "Open items": approved photography library beyond the
  -- live site isn't confirmed) -- left nullable, poster generation falls
  -- back to a brand-motif background when absent rather than guessing at
  -- placeholder photography.
  photo_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- developer_brand_profiles
-- Lightweight, module-7-local compliance metadata for co-branded posts.
-- NOT the Seller/Developer Inventory directory (SPEC.md module 4) -- see
-- header note above.
-- ============================================================
create table if not exists developer_brand_profiles (
  developer_name text primary key,
  allow_co_branding boolean not null default true,
  requires_developer_approval boolean not null default false,
  brand_guideline_notes text
);

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
  developer_partner_name text references developer_brand_profiles(developer_name),
  property_id uuid references properties(id) on delete set null,
  caption text not null default '',
  caption_source text not null default 'template' check (caption_source in ('template', 'ai')),
  scheduled_for timestamptz,
  created_by_role text not null check (created_by_role in ('founder', 'marketing', 'other')),
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
-- must never fabricate numbers into this table. See src/lib/data/metrics.ts.
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

-- ============================================================
-- ai_call_log (budget governor audit trail for this module)
-- Every AI-assisted call this module ever makes (currently: none -- caption
-- generation is template-based, see src/lib/ai/) must be logged here so the
-- daily cap in src/lib/ai/budget-governor.ts can enforce against real
-- counts, not an in-memory counter that resets on redeploy.
-- ============================================================
create table if not exists ai_call_log (
  id uuid primary key default uuid_generate_v4(),
  purpose text not null,
  post_id uuid references social_posts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_call_log_time on ai_call_log(created_at);
