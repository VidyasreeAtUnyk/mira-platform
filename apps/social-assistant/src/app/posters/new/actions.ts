'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createPost, InvalidPostStateError } from '@/lib/data/posts';
import { getListingForPoster } from '@/lib/data/properties';
import { generateCaption } from '@/lib/ai/caption';
import { getViewerRole } from '@/lib/auth/viewer-role';
import { canCreatePosters, POST_KINDS, SOCIAL_PLATFORMS, BRAND_MODES } from '@/types/social';
import type { PostKind, SocialPlatform, BrandMode } from '@/types/social';

export interface CreatePosterState {
  ok: boolean;
  error?: string;
}

function readEnum<T extends string>(formData: FormData, key: string, allowed: readonly T[]): T | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function readOptionalText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Server action backing the poster generation flow (src/app/posters/new).
 * Every draft lands with status 'draft' (see src/lib/data/posts.ts's
 * createPost) -- nothing here ever auto-publishes, per SPEC.md/CLAUDE.md.
 * Re-checks `canCreatePosters()` server-side even though the page also
 * gates the form -- see PROGRESS-social.md's forms guide note on always
 * verifying authorization inside the Server Action itself, not just the
 * page that renders the form.
 */
export async function createPosterDraft(
  _prevState: CreatePosterState,
  formData: FormData
): Promise<CreatePosterState> {
  const role = await getViewerRole();
  if (!canCreatePosters(role)) {
    return { ok: false, error: 'Poster creation is founder-only for now (SPEC.md RBAC table).' };
  }

  const kind = readEnum<PostKind>(formData, 'kind', POST_KINDS);
  const platform = readEnum<SocialPlatform>(formData, 'platform', SOCIAL_PLATFORMS);
  const brandMode = readEnum<BrandMode>(formData, 'brand_mode', BRAND_MODES);
  if (!kind || !platform || !brandMode) {
    return { ok: false, error: 'Missing or invalid kind/platform/brand mode.' };
  }

  const propertyId = readOptionalText(formData, 'property_id');
  const developerPartnerName =
    brandMode === 'co_branded' ? readOptionalText(formData, 'developer_partner_name') : undefined;
  if (brandMode === 'co_branded' && !developerPartnerName) {
    return { ok: false, error: 'Co-branded posts require a developer partner.' };
  }

  const scheduledForRaw = readOptionalText(formData, 'scheduled_for');
  const notes = readOptionalText(formData, 'notes');
  const captionOverride = readOptionalText(formData, 'caption');

  const listing = propertyId ? await getListingForPoster(propertyId) : null;

  const caption =
    captionOverride ?? generateCaption({ kind, brandMode, developerPartnerName: developerPartnerName ?? null, listing });

  try {
    await createPost({
      kind,
      platform,
      brand_mode: brandMode,
      developer_partner_name: developerPartnerName,
      property_id: propertyId,
      caption,
      scheduled_for: scheduledForRaw ? new Date(scheduledForRaw).toISOString() : undefined,
      created_by_role: role,
      notes,
    });
  } catch (err) {
    if (err instanceof InvalidPostStateError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create poster draft.' };
  }

  revalidatePath('/calendar');
  redirect('/calendar');
}
