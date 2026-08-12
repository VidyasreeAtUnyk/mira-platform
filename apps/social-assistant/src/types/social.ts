/**
 * apps/social-assistant's local type surface.
 *
 * Per CLAUDE.md ("don't redefine types that already exist there") this
 * module imports `Property` and `Agent` from `@mira/shared-types` rather
 * than forking them. Everything below is genuinely local to this module:
 * the content calendar, poster generation, and (stub) performance
 * monitoring concepts don't exist in the shared schema and aren't owned by
 * any other module.
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
import type { Property } from '@mira/shared-types';

export type { Property };

// ============================================================
// Content calendar
// ============================================================

/**
 * Draft-and-hold only, per CLAUDE.md/SPEC.md: nothing in this module marks
 * a post as actually "posted" or "published" because there is no live
 * posting integration yet and there shouldn't be one at this stage. If/when
 * a real posting integration lands, that's a deliberate, reviewed addition
 * to this enum -- not something to guess at now.
 */
export const POST_STATUSES = ['draft', 'pending_approval', 'approved', 'held'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'google_business'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const POST_KINDS = ['new_listing', 'price_update', 'sold', 'market_update', 'brand_general'] as const;
export type PostKind = (typeof POST_KINDS)[number];

/**
 * SPEC.md module 7 compliance note: "some developers have strict marketing
 * compliance rules" -- own-branded content is unrestricted (subject to the
 * normal approval queue); co_branded content additionally carries a
 * developer_partner_name and must be checked against that developer's
 * brand-usage rules (see DeveloperBrandProfile) before approval.
 */
export const BRAND_MODES = ['own', 'co_branded'] as const;
export type BrandMode = (typeof BRAND_MODES)[number];

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

export interface SocialPost {
  id: string;
  kind: PostKind;
  platform: Platform;
  status: PostStatus;
  brand_mode: BrandMode;
  /** Required when brand_mode = 'co_branded'; null for 'own'. */
  developer_partner_name: string | null;
  /** FK into shared `properties`, null for posts not tied to a listing (e.g. market_update, brand_general). */
  property_id: string | null;
  caption: string;
  /** Whether `caption` came from the template generator ('template') or a future AI path ('ai'). Always 'template' today -- see src/lib/ai/. */
  caption_source: 'template' | 'ai';
  scheduled_for: string | null;
  created_by_role: ViewerRole;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSocialPostInput {
  kind: PostKind;
  platform: Platform;
  brand_mode: BrandMode;
  developer_partner_name?: string;
  property_id?: string;
  caption?: string;
  scheduled_for?: string;
  created_by_role: ViewerRole;
  notes?: string;
}

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

export const METRIC_TYPES = ['impressions', 'reach', 'likes', 'comments', 'shares', 'saves', 'link_clicks'] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

/**
 * Schema/structure only, per this session's scope: there is no live posting
 * integration, so there is no live channel to pull real metrics from. Rows
 * in `social_post_metrics` are never fabricated -- `source` distinguishes a
 * genuine future ingestion ('platform_api') from anything else, and this
 * module currently never writes rows with real numbers. See
 * src/lib/data/metrics.ts.
 */
export interface SocialPostMetric {
  id: string;
  post_id: string;
  platform: Platform;
  metric_type: MetricType;
  value: number;
  source: 'platform_api' | 'manual_entry';
  recorded_at: string;
}
