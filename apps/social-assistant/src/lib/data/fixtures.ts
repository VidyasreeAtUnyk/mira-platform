/**
 * Dev/demo fixtures — used ONLY when no Supabase credentials are configured
 * (see hasSupabaseCredentials() in src/lib/supabase/service.ts). This lets
 * the module run and be reviewed without real database access, which
 * doesn't exist for this app in this environment yet (see PROGRESS-social.md
 * Blockers). Nothing here is production data; it never gets written to a
 * real database.
 */
import type { Property } from '@mira/shared-types';
import type { ListingMarketingDetails, DeveloperBrandProfile, SocialPost } from '@/types/social';

export const FIXTURE_PROPERTIES: Property[] = [
  {
    id: 'fixture-prop-1',
    address: 'Sobha Hartland II, Tower 3, Unit 1204',
    area: 'Sobha Hartland',
    type: 'apartment',
    price: 2450000,
    bedrooms: 2,
    tier: 'upgrade',
    created_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'fixture-prop-2',
    address: 'DAMAC Hills 2, Amazonia, Villa 44',
    area: 'DAMAC Hills 2',
    type: 'villa',
    price: 3800000,
    bedrooms: 4,
    tier: 'upgrade',
    created_at: '2026-07-15T00:00:00.000Z',
  },
];

export const FIXTURE_MARKETING_DETAILS: ListingMarketingDetails[] = [
  {
    id: 'fixture-md-1',
    property_id: 'fixture-prop-1',
    bathrooms: 3,
    community_name: 'Sobha Hartland',
    developer_partner_name: 'Sobha',
    listing_title: 'Waterfront living in Sobha Hartland',
    photo_url: null,
    created_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'fixture-md-2',
    property_id: 'fixture-prop-2',
    bathrooms: 5,
    community_name: 'DAMAC Hills 2',
    developer_partner_name: 'DAMAC',
    listing_title: 'Family villa, DAMAC Hills 2',
    photo_url: null,
    created_at: '2026-07-15T00:00:00.000Z',
  },
];

export const FIXTURE_DEVELOPER_PROFILES: DeveloperBrandProfile[] = [
  {
    developer_name: 'Sobha',
    allow_co_branding: true,
    requires_developer_approval: true,
    brand_guideline_notes:
      'Confirm current Sobha channel-partner marketing guidelines before combining marks — not verified in this build.',
  },
  {
    developer_name: 'DAMAC',
    allow_co_branding: true,
    requires_developer_approval: true,
    brand_guideline_notes:
      'Confirm current DAMAC Agents Portal marketing guidelines before combining marks — not verified in this build.',
  },
];

export const FIXTURE_POSTS: SocialPost[] = [
  {
    id: 'fixture-post-1',
    kind: 'new_listing',
    platform: 'instagram',
    status: 'draft',
    brand_mode: 'co_branded',
    developer_partner_name: 'Sobha',
    property_id: 'fixture-prop-1',
    caption:
      'New to the market: a 2-bed residence in Sobha Hartland — AED 2,450,000. Property, with purpose.',
    caption_source: 'template',
    scheduled_for: null,
    created_by_role: 'owner_coo',
    notes: null,
    created_at: '2026-08-10T09:00:00.000Z',
    updated_at: '2026-08-10T09:00:00.000Z',
  },
  {
    id: 'fixture-post-2',
    kind: 'brand_general',
    platform: 'instagram',
    status: 'pending_approval',
    brand_mode: 'own',
    developer_partner_name: null,
    property_id: null,
    caption: 'Rooted in heritage. Building legacies.',
    caption_source: 'template',
    scheduled_for: '2026-08-15T06:00:00.000Z',
    created_by_role: 'owner_coo',
    notes: 'Brand awareness post, no listing tie-in.',
    created_at: '2026-08-11T10:00:00.000Z',
    updated_at: '2026-08-11T10:00:00.000Z',
  },
];
