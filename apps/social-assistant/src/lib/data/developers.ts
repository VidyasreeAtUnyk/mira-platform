/**
 * Developer co-branding compliance profiles (`developer_brand_profiles`,
 * apps/social-assistant/db/schema.sql -- app-local, see that file's header
 * for why this stays local rather than promoted alongside social_posts).
 * Same fixture-fallback pattern as src/lib/data/properties.ts and
 * src/lib/data/posts.ts.
 */
import type { DeveloperBrandProfile } from '@/types/social';
import { hasSupabaseCredentials, createServiceClient } from '@/lib/supabase/service';
import { FIXTURE_DEVELOPER_PROFILES } from '@/lib/data/fixtures';

export async function listDeveloperProfiles(): Promise<DeveloperBrandProfile[]> {
  if (!hasSupabaseCredentials()) {
    return FIXTURE_DEVELOPER_PROFILES;
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('developer_brand_profiles').select('*').order('developer_name');
  if (error) throw new Error(`Failed to load developer profiles: ${error.message}`);
  return (data ?? []) as DeveloperBrandProfile[];
}
