/**
 * Reads listing data for poster generation from the SHARED `properties`
 * table (packages/shared-db/schema.sql) — never a local fork — plus this
 * module's additive `listing_marketing_details` sidecar (db/schema.sql).
 *
 * Falls back to in-memory fixtures when no Supabase credentials are
 * configured (see PROGRESS-social.md Blockers) so the module is reviewable
 * without live infrastructure. Fixture data is clearly separated in
 * src/lib/data/fixtures.ts and never presented as real listings.
 */
import type { Property } from '@mira/shared-types';
import type { ListingForPoster, ListingMarketingDetails } from '@/types/social';
import { hasSupabaseCredentials, createServiceClient } from '@/lib/supabase/service';
import { FIXTURE_PROPERTIES, FIXTURE_MARKETING_DETAILS } from '@/lib/data/fixtures';

export async function listProperties(): Promise<Property[]> {
  if (!hasSupabaseCredentials()) {
    return FIXTURE_PROPERTIES;
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load properties: ${error.message}`);
  return (data ?? []) as Property[];
}

export async function getListingForPoster(propertyId: string): Promise<ListingForPoster | null> {
  if (!hasSupabaseCredentials()) {
    const property = FIXTURE_PROPERTIES.find((p) => p.id === propertyId);
    if (!property) return null;
    const marketing = FIXTURE_MARKETING_DETAILS.find((m) => m.property_id === propertyId);
    return { ...property, ...marketing };
  }

  const supabase = createServiceClient();
  const [{ data: property, error: propErr }, { data: marketing, error: mdErr }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', propertyId).maybeSingle(),
    supabase
      .from('listing_marketing_details')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle(),
  ]);
  if (propErr) throw new Error(`Failed to load property: ${propErr.message}`);
  if (mdErr) throw new Error(`Failed to load listing marketing details: ${mdErr.message}`);
  if (!property) return null;

  const md = marketing as ListingMarketingDetails | null;
  return { ...(property as Property), ...(md ?? {}) };
}
