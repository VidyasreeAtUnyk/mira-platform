// ============================================================
// Shared enums
// ============================================================
/**
 * SPEC.md's RBAC table, 6 roles. Replaces an earlier 3-value seniority-level
 * enum (`agent`/`manager`/`admin`) that nothing in the codebase depended on
 * for real behavior -- two independent module builds (apps/dashboard's
 * `DashboardRole`, apps/comms-hub's `CommsRole`) each arrived at this exact
 * 6-value shape from SPEC.md's table without seeing each other's work,
 * which is why this is a single shared enum rather than two axes (a small
 * team doesn't need "seniority" and "access boundary" as separate concepts
 * -- see PROGRESS-integration.md for the full decision writeup).
 */
export const AGENT_ROLES = [
    "owner_coo",
    "senior_agent",
    "junior_agent",
    "marketing_social",
    "admin_ops",
    "finance",
];
export const AGENT_ROLE_LABELS = {
    owner_coo: "Owner / COO",
    senior_agent: "Senior Agent",
    junior_agent: "Junior Agent",
    marketing_social: "Marketing / Social",
    admin_ops: "Admin / Ops",
    finance: "Finance",
};
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
// ============================================================
// Goals / trackers (module 10 -- added post-Phase-0 by apps/trackers,
// see packages/shared-db/migrations/001_trackers_goals.sql for the DDL and
// PROGRESS-trackers.md "Notes / decisions made" for why this was promoted
// to the shared package rather than kept apps/trackers-local: revenue and
// activity targets are read by the Today view / monthly report (SPEC.md
// modules 2 and 11), not trackers-only data.
// ============================================================
export const GOAL_SCOPES = ["individual", "team"];
export const GOAL_PERIOD_TYPES = ["daily", "weekly", "monthly", "quarterly", "custom"];
export const GOAL_STATUSES = ["active", "completed", "archived"];
/**
 * Recommended metric vocabulary, kept as free text (not a DB CHECK) for the
 * same reason as RECOMMENDED_LEAD_SOURCES above -- the set of things a COO
 * wants to track (revenue, lead volume, activity counts, ...) is expected to
 * grow without needing a schema change every time.
 */
export const RECOMMENDED_GOAL_METRICS = [
    "revenue_aed",
    "deals_closed",
    "leads_contacted",
    "viewings_booked",
    "calls_made",
    "new_leads_added",
    "proposals_sent",
    "other",
];
// ============================================================
// Social content calendar (module 7 -- added post-Phase-0 by
// apps/social-assistant, packages/shared-db/migrations/002_social_posts.sql).
// Promoted here (not kept apps/social-assistant-local) because post/poster
// status is read by more than just the social-assistant UI:
//   * SPEC.md module 2 (Dashboard / "Today view") -- pending-approval posts
//     are exactly the kind of thing the review/approval queue surfaces.
//   * SPEC.md module 11 (Monthly report) rolls up marketing ROI, which reads
//     social_posts + social_post_metrics.
// See PROGRESS-social.md Notes for the full promotion rationale, and
// packages/shared-db/migrations/002_social_posts.sql's header for the schema
// side of this decision.
//
// Deliberately NOT promoted (stay apps/social-assistant-local, see that
// app's src/types/social.ts and db/schema.sql): `listing_marketing_details`
// (a properties sidecar awaiting a real fold-in decision), developer
// co-branding compliance profiles (placeholder pending module 4's real
// developer partner directory), `ai_call_log` (internal budget-governor
// bookkeeping, same category as apps/lead-agent's app-local run_state/
// run_metrics), and `ViewerRole`/`canCreatePosters` (a stand-in for RBAC that
// hasn't landed in the shared schema yet, see SPEC.md's RBAC table).
// ============================================================
/**
 * Draft-and-hold only, per CLAUDE.md/SPEC.md: nothing marks a post as
 * actually "posted"/"published" because no live posting integration exists,
 * and there shouldn't be one at this stage. Extending this enum with a real
 * "posted" state is a deliberate, reviewed addition for whenever a live
 * posting integration lands -- not something to guess at now.
 */
export const POST_STATUSES = ["draft", "pending_approval", "approved", "held"];
export const SOCIAL_PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok", "google_business"];
export const POST_KINDS = ["new_listing", "price_update", "sold", "market_update", "brand_general"];
/**
 * SPEC.md module 7: "some developers have strict marketing compliance
 * rules" -- own-branded content is unrestricted (subject to the normal
 * approval queue); co_branded content additionally names a developer
 * partner and must be checked against that developer's brand-usage rules
 * before approval (see apps/social-assistant's local DeveloperBrandProfile).
 */
export const BRAND_MODES = ["own", "co_branded"];
export const SOCIAL_METRIC_TYPES = [
    "impressions",
    "reach",
    "likes",
    "comments",
    "shares",
    "saves",
    "link_clicks",
];
// ============================================================
// Notification priority tiers (SPEC.md module 6: "Notification center with
// priority tiers (urgent / today / fyi)"). Promoted from
// apps/comms-hub/src/types/index.ts (that module's local `NotificationTier`)
// as part of the same RBAC-promotion decision above -- the dashboard's
// unified review/approval queue needs a shared priority concept to sort
// items from multiple modules (proposals, social posts, comms threads)
// against one scale. The *computation* of a tier stays module-local (each
// module's items become urgent/today/fyi for different reasons -- see
// apps/comms-hub/src/lib/tiers.ts's computeTier() for that module's
// heuristic); only the type and its display metadata are shared.
// ============================================================
export const NOTIFICATION_TIERS = ["urgent", "today", "fyi"];
export const NOTIFICATION_TIER_LABELS = {
    urgent: "Urgent",
    today: "Today",
    fyi: "FYI",
};
/** Lower = higher priority. Sort ascending for urgent-first ordering. */
export const NOTIFICATION_TIER_ORDER = {
    urgent: 0,
    today: 1,
    fyi: 2,
};
