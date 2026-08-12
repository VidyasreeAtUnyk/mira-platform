// ============================================================
// Shared enums
// ============================================================
export const AGENT_ROLES = ["agent", "manager", "admin"];
export const LEAD_TYPES = ["buyer", "seller", "tenant", "landlord"];
export const PROPERTY_TYPES = ["apartment", "villa", "townhouse", "commercial", "land"];
export const BEDROOM_OPTIONS = ["studio", "1", "2", "3", "4+"];
/**
 * Recommended values, union of both pre-merge apps' vocabularies -- kept as
 * free text (not a DB CHECK constraint) since lead-source channels are
 * expected to keep growing and a merge is the wrong place to lock that down.
 */
export const RECOMMENDED_LEAD_SOURCES = [
    "family",
    "friend",
    "referral",
    "bayut",
    "property_finder",
    "instagram",
    "apollo",
    "dld",
    "walk_in",
    "other",
];
/** apps/crm's human-contact-log concept: an agent logging a call/email/etc against a lead. */
export const INTERACTION_TYPES = ["call", "whatsapp", "email", "viewing", "meeting", "note"];
export const INTERACTION_OUTCOMES = ["positive", "neutral", "negative", "no_answer"];
/**
 * apps/lead-agent's passive-signal concept, renamed from its original table
 * name `interactions` to `engagement_events` during the merge to avoid
 * colliding with apps/crm's (semantically different) `interactions` table
 * above. See PROGRESS-phase0.md Notes for why these were kept as two tables
 * instead of one.
 */
export const ENGAGEMENT_EVENT_TYPES = ["page_view", "email_open", "reply", "inquiry"];
export const PROPOSAL_TYPES = ["message", "viewing"];
export const PROPOSAL_STATUSES = ["pending", "approved", "rejected"];
export const SUGGESTION_TYPES = ["followup_message", "upgrade_proposal", "lead_score"];
export const SUGGESTION_STATUSES = ["pending", "approved", "rejected", "sent"];
export const PROPERTY_TIERS = ["standard", "upgrade"];
export const AUDIT_ACTORS = ["agent", "human"];
