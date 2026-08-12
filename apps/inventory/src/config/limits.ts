/**
 * Tunable limits/thresholds for this module, in one place -- same
 * convention as apps/lead-agent/src/config/limits.ts.
 */

/** MOU terms whose term_end falls within this many days count as "expiring soon" for the compliance view. */
export const MOU_EXPIRING_SOON_DAYS = 60;

/** Max rows accepted in a single CSV/paste ingestion call -- a sane guardrail against a malformed/huge paste, not a real volume limit. */
export const MAX_INGESTION_ROWS = 2000;

/**
 * Budget governor note (CLAUDE.md / SPEC.md): this module makes no calls to
 * the Anthropic API or any other paid AI/vision service this session --
 * ingestion is CSV/paste text parsing only, no model call involved. If
 * screenshot-parsing (AI-vision-on-screenshot, per SPEC.md module 4) is
 * built in a future session, it MUST get its own capped budget entry here
 * (e.g. max screenshots parsed per run/day) before any such call is added --
 * do not wire up a vision call without one.
 */
