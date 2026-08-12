-- apps/social-assistant/db/schema.sql
--
-- App-local additive schema for the social media assistant module -- the
-- tables here are genuinely local (nothing outside this app reads them
-- today). This is NOT part of packages/shared-db, same precedent
-- apps/lead-agent's run_state/run_metrics tables follow (see
-- packages/shared-db/schema.sql header comment).
--
-- RESOLVED (see PROGRESS-social.md Notes for the full writeup): this file
-- originally also drafted `social_posts` and `social_post_metrics` here.
-- Both were promoted to packages/shared-db/migrations/002_social_posts.sql
-- instead, because SPEC.md module 2 (Dashboard/Today view, via the
-- review/approval queue) and module 11 (Monthly report, marketing ROI) are
-- both expected to read post/poster status -- exactly the "add to shared
-- packages, don't fork a local copy" case CLAUDE.md calls out. `ai_call_log`
-- below has an FK into `social_posts`, which now lives in that shared
-- migration file, not this one.
--
-- Assumes it applies to the SAME Postgres database as
-- packages/shared-db/schema.sql AND
-- packages/shared-db/migrations/002_social_posts.sql (foreign keys
-- reference `properties` there, and `ai_call_log.post_id` references
-- `social_posts` there). Apply in this order:
--   psql mira_dev -f packages/shared-db/schema.sql
--   psql mira_dev -f packages/shared-db/migrations/002_social_posts.sql
--   psql mira_dev -f apps/social-assistant/db/schema.sql
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
-- ai_call_log (budget governor audit trail for this module)
-- Every AI-assisted call this module ever makes (currently: none -- caption
-- generation is template-based, see src/lib/ai/caption.ts) must be logged
-- here so the daily cap in src/lib/ai/budget-governor.ts can enforce
-- against real counts, not an in-memory counter that resets on redeploy.
-- `post_id` references `social_posts`, which now lives in
-- packages/shared-db/migrations/002_social_posts.sql -- see this file's
-- header for the promotion decision and required apply order.
-- ============================================================
create table if not exists ai_call_log (
  id uuid primary key default uuid_generate_v4(),
  purpose text not null,
  post_id uuid references social_posts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_call_log_time on ai_call_log(created_at);
