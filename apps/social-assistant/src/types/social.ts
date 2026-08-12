/**
 * apps/social-assistant's local type surface.
 *
 * Per CLAUDE.md ("don't redefine types that already exist there") this
 * module imports `Property`/`Agent` AND (as of the schema-placement
 * decision below) `PostStatus`/`SocialPlatform`/`PostKind`/`BrandMode`/
 * `SocialPost`/`CreateSocialPostInput`/`SocialMetricType`/
 * `SocialPostMetric` from `@mira/shared-types` rather than forking them --
 * those were promoted to shared-types + packages/shared-db/migrations/
 * 002_social_posts.sql because the Dashboard (Today view / review-approval
 * queue) and Monthly report (marketing ROI) are both expected to read
 * post/poster status. See PROGRESS-social.md Notes for the full writeup and
 * packages/shared-types/src/domain.ts's "Social content calendar" section
 * for what stayed local vs. what promoted.
 *
 * Everything below IS still genuinely local to this module: poster
 * generation inputs, the marketing-sidecar concept, developer co-branding
 * compliance (a placeholder ahead of module 4's real directory), viewer
 * role/RBAC stand-in, and the (stub) performance-monitoring result shape.
 *
 * Known gap (see PROGRESS-social.md Notes): the shared `properties` table
 * (packages/shared-db/schema.sql) only has address/area/type/price/bedrooms/
 * tier -- no bathrooms, developer partner, community name, listing title, or
 * photos, all of which BRAND-KIT.md's poster rules call for ("pull price/
 * beds/baths/community name/developer partner from the listing record").
 * Rather than fork a competing "properties" type (forbidden) or reach into
 * packages/shared-db to extend the shared table (forbidden by this
 * session's module-boundary instructions during parallel fan-out -- see
 * PROGRESS-social.md), this module defines `ListingMarketingDetails` as an
 * ADDITIVE, app-local sidecar keyed by property_id. It is not a
 * replacement/fork of `Property` -- every field on `Property` itself is
 * still read from the shared table untouched. Flagged for the integration
 * pass to fold the marketing-relevant fields (bathrooms, developer,
 * community, photos) into the real shared schema.
 */
import type {
  Property,
  PostStatus,
  SocialPlatform,
  PostKind,
  BrandMode,
  SocialPost,
  CreateSocialPostInput,
  SocialMetricType,
  SocialPostMetric,
} from '@mira/shared-types';
import {
  POST_STATUSES,
  SOCIAL_PLATFORMS,
  POST_KINDS,
  BRAND_MODES,
  SOCIAL_METRIC_TYPES,
} from '@mira/shared-types';

export type {
  Property,
  PostStatus,
  SocialPlatform,
  PostKind,
  BrandMode,
  SocialPost,
  CreateSocialPostInput,
  SocialMetricType,
  SocialPostMetric,
};
export { POST_STATUSES, SOCIAL_PLATFORMS, POST_KINDS, BRAND_MODES, SOCIAL_METRIC_TYPES };

/** @deprecated Local alias kept only so existing imports of `Platform` in this app don't all need renaming in one pass. Use `SocialPlatform` (from `@mira/shared-types`) directly in new code. */
export type Platform = SocialPlatform;
/** @deprecated see `Platform` above -- use `SOCIAL_PLATFORMS` directly in new code. */
export const PLATFORMS = SOCIAL_PLATFORMS;
/** @deprecated see `Platform` above -- use `SocialMetricType` directly in new code. */
export type MetricType = SocialMetricType;
/** @deprecated see `Platform` above -- use `SOCIAL_METRIC_TYPES` directly in new code. */
export const METRIC_TYPES = SOCIAL_METRIC_TYPES;

// ============================================================
// Content calendar
// ============================================================

/**
 * SPEC.md RBAC table: poster creation is "Founder-only-for-now" (opens to
 * junior/marketing staff later via config, no code change per SPEC.md).
 * `@mira/shared-types`'s `AgentRole` ('agent' | 'manager' | 'admin') doesn't
 * model "founder" or "marketing" -- those are SPEC.md RBAC roles that
 * haven't landed in the shared schema yet. Rather than guess at shared-type
 * changes (out of bounds for this module), this is a local, deliberately
 * minimal capability check pending real RBAC. See PROGRESS-social.md Notes.
 */
export const POSTER_CREATOR_VIEWER_ROLES = ['founder', 'marketing', 'other'] as const;
export type ViewerRole = (typeof POSTER_CREATOR_VIEWER_ROLES)[number];

export function canCreatePosters(role: ViewerRole): boolean {
  // Founder-only-for-now (SPEC.md RBAC table). Loosen via config later, not
  // by editing this function inline per request -- see SPEC.md's "loosens
  // over time" note.
  return role === 'founder';
}

/**
 * App-local sidecar table (db/schema.sql: listing_marketing_details) for
 * poster-relevant fields the shared `properties` table doesn't carry yet.
 * `property_id` is a foreign key into the shared `properties` table.
 */
export interface ListingMarketingDetails {
  id: string;
  property_id: string;
  bathrooms: number | null;
  community_name: string | null;
  developer_partner_name: string | null;
  listing_title: string | null;
  photo_url: string | null;
  created_at: string;
}

/**
 * A property joined with its (optional) marketing sidecar row -- what the
 * poster generator actually consumes.
 */
export type ListingForPoster = Property & Partial<Omit<ListingMarketingDetails, 'id' | 'property_id' | 'created_at'>>;

export interface UpdateSocialPostStatusInput {
  status: PostStatus;
}

// ============================================================
// Developer co-branding compliance (lightweight, module-4-adjacent)
// ============================================================

/**
 * NOT a fork of module 4's future "developer partner directory" (Seller/
 * Developer Inventory, SPEC.md module 4 -- a different agent's lane). This
 * is intentionally minimal: just enough to gate poster approval on
 * co-branding rules today. Flagged in PROGRESS-social.md for the
 * integration pass to consolidate with the real directory once module 4
 * ships.
 */
export interface DeveloperBrandProfile {
  developer_name: string;
  allow_co_branding: boolean;
  requires_developer_approval: boolean;
  brand_guideline_notes: string | null;
}

// ============================================================
// Performance monitoring (stub -- no live channel to pull from yet)
// ============================================================
// `MetricType`/`METRIC_TYPES`/`SocialPostMetric` now come from
// `@mira/shared-types` (see the promoted re-exports at the top of this
// file) -- structure/shape is unchanged, only the source of truth moved.
