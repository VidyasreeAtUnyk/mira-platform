/**
 * Poster generation — programmatic SVG templating driven by brand tokens
 * (src/lib/brand/tokens.ts) + real listing data (src/lib/data/properties.ts,
 * sourced from the shared `properties` table). Deliberately not an
 * external image-gen AI call: SVG/HTML-to-image templating respects the
 * budget governor (SPEC.md) and doesn't need an API key that doesn't exist
 * for this module (see PROGRESS-social.md Blockers).
 *
 * Encodes BRAND-KIT.md's "Poster generation rules" section:
 *   1. Monogram+wordmark lockup always included.
 *   2. Palette restricted to BRAND_COLORS — no off-brand colors introduced.
 *   3. At most one script-font accent line.
 *   4. New-listing posters are data-driven (price/beds/baths/community/
 *      developer pulled from the listing record, not free text).
 *   5. Own-brand vs developer-co-branded content is visually distinguished
 *      (a developer credit line appears only for co_branded posts).
 *   6. Output is a draft asset for the review queue — this module has no
 *      auto-publish path anywhere.
 */
import { BRAND_COLORS, BRAND_FONTS, BRAND_COPY } from '@/lib/brand/tokens';
import type { ListingForPoster, BrandMode, PostKind } from '@/types/social';

export interface PosterInput {
  kind: PostKind;
  brandMode: BrandMode;
  developerPartnerName?: string | null;
  listing?: ListingForPoster | null;
  /** At most one — BRAND-KIT.md rule #3 ("one emotional/script-font line per poster maximum"). */
  scriptAccentLine?: string;
  headline?: string;
}

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5, standard Instagram portrait

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatAED(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** BRAND-KIT.md: "Small line-art footer illustration (e.g. palm trees / low-rise skyline) as a grounding motif." */
function footerMotif(x: number, y: number): string {
  return `
  <g stroke="${BRAND_COLORS.accentGold}" stroke-width="2" fill="none" opacity="0.55" transform="translate(${x},${y})">
    <path d="M0,40 L40,40 L40,10 M10,40 L10,20 M20,40 L20,5 M30,40 L30,25" />
    <path d="M60,40 Q75,0 90,40" />
    <path d="M110,40 L150,40 L150,15 L170,15 L170,40 L200,40" />
  </g>`;
}

/** BRAND-KIT.md: monogram (M + flame accent) stacked above the wordmark, gold diamond divider. No real logo artwork exists — see BRAND_ASSET_CONFIDENCE. */
function logoLockup(centerX: number, y: number): string {
  return `
  <g transform="translate(${centerX},${y})" text-anchor="middle">
    <g transform="translate(0,-10)">
      <path d="M-14,20 L-14,-16 L0,4 L14,-16 L14,20" stroke="${BRAND_COLORS.accentGold}" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round" />
      <path d="M0,-30 C6,-22 6,-14 0,-8 C-6,-14 -6,-22 0,-30 Z" fill="${BRAND_COLORS.accentGold}" />
    </g>
    <text y="46" font-family='${BRAND_FONTS.displaySerifEmphasis}' font-size="34" font-weight="700" letter-spacing="6" fill="${BRAND_COLORS.bodyText}">${BRAND_COPY.wordmarkLine1}</text>
    <g transform="translate(0,60)">
      <line x1="-70" y1="0" x2="-10" y2="0" stroke="${BRAND_COLORS.accentGold}" stroke-width="1" opacity="0.6" />
      <path d="M0,-6 L6,0 L0,6 L-6,0 Z" fill="${BRAND_COLORS.accentGold}" />
      <line x1="10" y1="0" x2="70" y2="0" stroke="${BRAND_COLORS.accentGold}" stroke-width="1" opacity="0.6" />
    </g>
    <text y="82" font-family='${BRAND_FONTS.bodySans}' font-size="14" letter-spacing="4" fill="${BRAND_COLORS.accentGoldLight}">${BRAND_COPY.wordmarkLine2}</text>
  </g>`;
}

function listingFacts(listing: ListingForPoster): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  facts.push({ label: 'PRICE', value: formatAED(listing.price) });
  facts.push({ label: 'BEDS', value: String(listing.bedrooms) });
  if (listing.bathrooms != null) facts.push({ label: 'BATHS', value: String(listing.bathrooms) });
  facts.push({ label: 'COMMUNITY', value: listing.community_name ?? listing.area });
  return facts;
}

function factRow(facts: { label: string; value: string }[], x: number, y: number, width: number): string {
  const colWidth = width / facts.length;
  return facts
    .map((f, i) => {
      const cx = x + colWidth * i + colWidth / 2;
      return `
      <text x="${cx}" y="${y}" text-anchor="middle" font-family='${BRAND_FONTS.bodySans}' font-size="15" letter-spacing="2" fill="${BRAND_COLORS.accentGoldLight}">${escapeXml(f.label)}</text>
      <text x="${cx}" y="${y + 34}" text-anchor="middle" font-family='${BRAND_FONTS.displaySerifSupporting}' font-size="26" fill="${BRAND_COLORS.bodyText}">${escapeXml(f.value)}</text>`;
    })
    .join('');
}

/**
 * Renders one poster to a self-contained SVG string. Deterministic given
 * the same input — no AI call involved (see module header).
 */
export function generatePosterSVG(input: PosterInput): string {
  const { kind, brandMode, developerPartnerName, listing, scriptAccentLine, headline } = input;
  const margin = 56;

  const defaultHeadline =
    kind === 'new_listing' && listing
      ? (listing.listing_title ?? 'A NEW CHAPTER')
      : headline ?? 'PROPERTY, WITH PURPOSE';

  const facts = listing ? listingFacts(listing) : [];

  const developerCredit =
    brandMode === 'co_branded' && developerPartnerName
      ? `<text x="${WIDTH / 2}" y="${HEIGHT - 150}" text-anchor="middle" font-family='${BRAND_FONTS.bodySans}' font-size="14" letter-spacing="3" fill="${BRAND_COLORS.accentGoldLight}">IN PARTNERSHIP WITH ${escapeXml(developerPartnerName.toUpperCase())}</text>`
      : '';

  const scriptLine = scriptAccentLine
    ? `<text x="${WIDTH / 2}" y="${HEIGHT - 195}" text-anchor="middle" font-family='${BRAND_FONTS.scriptAccent}' font-size="30" fill="${BRAND_COLORS.accentGoldLight}">${escapeXml(scriptAccentLine)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BRAND_COLORS.backgroundPrimary}" />
      <stop offset="100%" stop-color="${BRAND_COLORS.backgroundAlt}" />
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />

  <!-- BRAND-KIT.md motif: thin gold border frame around the full poster canvas -->
  <rect x="${margin / 2}" y="${margin / 2}" width="${WIDTH - margin}" height="${HEIGHT - margin}" fill="none" stroke="${BRAND_COLORS.accentGold}" stroke-width="1.5" opacity="0.7" />

  ${logoLockup(WIDTH / 2, 150)}

  <text x="${WIDTH / 2}" y="${HEIGHT / 2 - 60}" text-anchor="middle" font-family='${BRAND_FONTS.displaySerifSupporting}' font-size="26" letter-spacing="3" fill="${BRAND_COLORS.bodyText}">${kind === 'new_listing' ? 'NEW LISTING' : kind.replace('_', ' ').toUpperCase()}</text>
  <text x="${WIDTH / 2}" y="${HEIGHT / 2}" text-anchor="middle" font-family='${BRAND_FONTS.displaySerifEmphasis}' font-size="46" font-weight="700" letter-spacing="2" fill="${BRAND_COLORS.accentGold}">
    <tspan x="${WIDTH / 2}" dy="0">${escapeXml(defaultHeadline.toUpperCase())}</tspan>
  </text>

  ${facts.length > 0 ? factRow(facts, margin, HEIGHT / 2 + 90, WIDTH - margin * 2) : ''}

  ${scriptLine}
  ${developerCredit}

  ${footerMotif(WIDTH / 2 - 100, HEIGHT - 110)}

  <text x="${WIDTH / 2}" y="${HEIGHT - 40}" text-anchor="middle" font-family='${BRAND_FONTS.bodySans}' font-size="12" letter-spacing="3" fill="${BRAND_COLORS.hairline}" opacity="0.8">DRAFT — NOT FOR PUBLICATION</text>
</svg>`;
}
