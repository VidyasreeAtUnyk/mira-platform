/**
 * Caption generation -- template-based, NOT an AI call. This is the file
 * budget-governor.ts's header comment refers to ("caption generation
 * (src/lib/ai/caption.ts) is template-based") but that was never actually
 * written before this session's rate-limit cutoff -- writing it now as part
 * of the poster generation flow (see src/app/posters/new).
 *
 * Deterministic string composition from brand copy + listing facts. No
 * network call, no `checkAndRecordCall()` needed (that gate is only for
 * paid AI/model API calls, per SPEC.md/CLAUDE.md's budget-governor rule --
 * see src/lib/ai/budget-governor.ts's header). If/when a real AI-assisted
 * captioning path is added later, it must call `checkAndRecordCall()`
 * first and set `caption_source: 'ai'` -- this file stays the
 * `caption_source: 'template'` path.
 */
import { BRAND_COPY } from '@/lib/brand/tokens';
import type { ListingForPoster, PostKind, BrandMode } from '@/types/social';

function formatAED(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface CaptionInput {
  kind: PostKind;
  brandMode: BrandMode;
  developerPartnerName?: string | null;
  listing?: ListingForPoster | null;
}

const KIND_OPENERS: Record<PostKind, string> = {
  new_listing: 'New to the market:',
  price_update: 'Updated pricing:',
  sold: 'Just closed:',
  market_update: 'Market note:',
  brand_general: '',
};

/**
 * Deterministic, template-based caption. Same rules as the poster generator
 * (BRAND-KIT.md #4: data-driven, not free-text-prompted) -- pulls facts
 * straight from the listing record rather than inventing copy.
 */
export function generateCaption(input: CaptionInput): string {
  const { kind, brandMode, developerPartnerName, listing } = input;
  const parts: string[] = [];

  const opener = KIND_OPENERS[kind];
  if (opener) parts.push(opener);

  if (listing) {
    const bedWord = listing.bedrooms === 1 ? '1-bed' : `${listing.bedrooms}-bed`;
    const place = listing.community_name ?? listing.area;
    parts.push(`a ${bedWord} residence in ${place} — ${formatAED(listing.price)}.`);
  }

  if (brandMode === 'co_branded' && developerPartnerName) {
    parts.push(`In partnership with ${developerPartnerName}.`);
  }

  parts.push(BRAND_COPY.taglines[0]);

  return parts.filter(Boolean).join(' ');
}
