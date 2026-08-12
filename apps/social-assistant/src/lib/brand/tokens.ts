/**
 * Brand tokens, transcribed directly from /brand-kit/BRAND-KIT.md (read-only
 * reference — never edited by this module). Every value flagged
 * `needsFounderConfirmation: true` corresponds to an entry in BRAND-KIT.md's
 * "Open items to confirm with founder" section — this module uses the
 * approximate value BRAND-KIT.md provides but does NOT invent a value for
 * anything BRAND-KIT.md doesn't already give an approximation for. See
 * PROGRESS-social.md Blockers for the founder-facing summary of these.
 */

export const BRAND_COLORS = {
  backgroundPrimary: '#0B1B20',
  backgroundAlt: '#0D1F26',
  accentGold: '#C9A24C',
  accentGoldLight: '#D8B36A',
  bodyText: '#F2ECE0',
  hairline: '#C9A24C', // used at low opacity for borders/dividers, per BRAND-KIT.md
} as const;

export const BRAND_COLOR_CONFIDENCE = {
  needsFounderConfirmation: true,
  reason:
    'BRAND-KIT.md: "Treat hex values as close approximations pending exact values from source files (logo AI/EPS or Figma if it exists) — verify with the founder before locking into design tokens."',
} as const;

/**
 * Web-safe/Google Fonts stand-ins chosen to mirror BRAND-KIT.md's described
 * hierarchy (bold serif caps / lighter serif caps / clean sans / italic
 * script). These are explicitly NOT the brand's real typefaces —
 * BRAND-KIT.md lists "exact typeface names/licenses" as an open item.
 * Swap these the moment the founder confirms real fonts; do not treat this
 * as the final choice.
 */
export const BRAND_FONTS = {
  displaySerifEmphasis: '"Playfair Display", Georgia, serif', // stand-in for bold serif caps
  displaySerifSupporting: '"Cormorant Garamond", Georgia, serif', // stand-in for lighter serif caps
  bodySans: '"Inter", system-ui, sans-serif',
  scriptAccent: '"Petit Formal Script", "Brush Script MT", cursive', // stand-in for the italic script accent line
} as const;

export const BRAND_FONT_CONFIDENCE = {
  needsFounderConfirmation: true,
  reason:
    'BRAND-KIT.md: "Identify and lock the exact typefaces once source design files are available; until then, use closely-matched web-safe/Google Fonts... that mirrors this hierarchy." These are placeholders, not the real brand fonts.',
} as const;

export const BRAND_COPY = {
  fullName: 'MIRA Agam Properties',
  wordmarkLine1: 'MIRA',
  wordmarkLine2: 'AGAM PROPERTIES',
  taglines: ['Property, with purpose.', 'Rooted in heritage. Building legacies.'],
} as const;

/**
 * BRAND-KIT.md poster generation rule #1: "Every poster must include the
 * monogram+wordmark lockup — never omit it." No approved logo asset file
 * exists in brand-kit/ (only BRAND-KIT.md's textual description), so the
 * generator draws a simple gold monogram+flame glyph + letter-spaced
 * wordmark in SVG/text rather than compositing a raster logo. Flagged
 * alongside the other open items — real logo artwork (AI/EPS/Figma) is
 * listed as the source BRAND-KIT.md wants hex/type values pulled from, and
 * it isn't in this repo.
 */
export const BRAND_ASSET_CONFIDENCE = {
  needsFounderConfirmation: true,
  reason:
    'No logo source file (AI/EPS/Figma) exists in brand-kit/ — poster generator draws a placeholder monogram+wordmark lockup in SVG instead of compositing real logo artwork.',
} as const;

/** All open items this module is deliberately NOT guessing at. Surfaced in the calendar UI and PROGRESS-social.md. */
export const BRAND_OPEN_ITEMS = [
  'Exact hex values (pull from logo source file / brand guideline PDF if one exists) — using BRAND-KIT.md approximations for now.',
  'Exact typeface names/licenses — using web-safe stand-ins for now.',
  'Any additional approved photography library beyond what\'s on the live site — posters fall back to a brand-motif background (no photo) when a listing has no photo_url.',
  'No logo source artwork (AI/EPS/Figma) in the repo — poster generator draws the monogram+wordmark lockup programmatically instead of compositing a real logo file.',
] as const;
