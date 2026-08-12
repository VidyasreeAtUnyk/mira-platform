import type { Stage, Segment, LegacyCrmStatus } from "./stage.js";

// ============================================================
// Shared enums
// ============================================================

export const AGENT_ROLES = ["agent", "manager", "admin"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const LEAD_TYPES = ["buyer", "seller", "tenant", "landlord"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const PROPERTY_TYPES = ["apartment", "villa", "townhouse", "commercial", "land"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const BEDROOM_OPTIONS = ["studio", "1", "2", "3", "4+"] as const;
export type BedroomOption = (typeof BEDROOM_OPTIONS)[number];

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
] as const;
export type RecommendedLeadSource = (typeof RECOMMENDED_LEAD_SOURCES)[number];

/** apps/crm's human-contact-log concept: an agent logging a call/email/etc against a lead. */
export const INTERACTION_TYPES = ["call", "whatsapp", "email", "viewing", "meeting", "note"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_OUTCOMES = ["positive", "neutral", "negative", "no_answer"] as const;
export type InteractionOutcome = (typeof INTERACTION_OUTCOMES)[number];

/**
 * apps/lead-agent's passive-signal concept, renamed from its original table
 * name `interactions` to `engagement_events` during the merge to avoid
 * colliding with apps/crm's (semantically different) `interactions` table
 * above. See PROGRESS-phase0.md Notes for why these were kept as two tables
 * instead of one.
 */
export const ENGAGEMENT_EVENT_TYPES = ["page_view", "email_open", "reply", "inquiry"] as const;
export type EngagementEventType = (typeof ENGAGEMENT_EVENT_TYPES)[number];

export const PROPOSAL_TYPES = ["message", "viewing"] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export const PROPOSAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const SUGGESTION_TYPES = ["followup_message", "upgrade_proposal", "lead_score"] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

export const SUGGESTION_STATUSES = ["pending", "approved", "rejected", "sent"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const PROPERTY_TIERS = ["standard", "upgrade"] as const;
export type PropertyTier = (typeof PROPERTY_TIERS)[number];

export const AUDIT_ACTORS = ["agent", "human"] as const;
export type AuditActor = (typeof AUDIT_ACTORS)[number];

// ============================================================
// Row types (canonical shared Postgres schema -- see packages/shared-db)
// ============================================================

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: AgentRole;
  created_at: string;
}

export interface Lead {
  id: string;
  agent_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  lead_type: LeadType;
  property_type: PropertyType | null;
  /** Freeform discovery-stage text (lead-agent). Distinct from property_type -- see shared-db/schema.sql. */
  property_interest: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  preferred_areas: string[] | null;
  location_pref: string | null;
  bedrooms: BedroomOption | null;
  timeline: string | null;
  segment: Segment;
  stage: Stage;
  /** @deprecated legacy apps/crm display column, unenforced -- read/write `stage` instead. */
  status: LegacyCrmStatus | null;
  source: string | null;
  notes: string | null;
  owns_property: boolean;
  owned_property_type: PropertyType | null;
  owned_property_area: string | null;
  owned_purchase_year: number | null;
  owned_purchase_price: number | null;
  do_not_contact: boolean;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  contact_count: number;
  locked_at: string | null;
  locked_by: string | null;
  ai_score: number | null;
  ai_score_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  lead_id: string;
  agent_id: string | null;
  type: InteractionType;
  summary: string;
  outcome: InteractionOutcome | null;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
}

export interface EngagementEvent {
  id: string;
  lead_id: string;
  type: EngagementEventType;
  detail: string | null;
  created_at: string;
}

export interface Proposal {
  id: string;
  lead_id: string;
  type: ProposalType;
  content: string;
  status: ProposalStatus;
  rejection_reason: string | null;
  proposed_time: string | null;
  created_at: string;
}

export interface AISuggestion {
  id: string;
  lead_id: string;
  suggestion_type: SuggestionType;
  content: string | null;
  score: number | null;
  score_reason: string | null;
  status: SuggestionStatus;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  lead_id: string | null;
  tool_name: string;
  input_json: unknown;
  output_json: unknown;
  actor: AuditActor;
  created_at: string;
}

export interface Property {
  id: string;
  address: string;
  area: string;
  type: string;
  price: number;
  bedrooms: number;
  tier: PropertyTier;
  created_at: string;
}

export interface PropertyPriceHistory {
  id: string;
  property_id: string;
  year: number;
  avg_price: number;
}

export interface DLDPriceIndex {
  id: string;
  first_date_of_month: string;
  all_monthly_index: number | null;
  flat_monthly_index: number | null;
  villa_monthly_index: number | null;
  all_monthly_price_index: number | null;
  flat_monthly_price_index: number | null;
  villa_monthly_price_index: number | null;
}

// ============================================================
// Input types
// ============================================================

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  lead_type: LeadType;
  property_type?: PropertyType;
  property_interest?: string;
  budget_min?: number;
  budget_max?: number;
  preferred_areas?: string[];
  location_pref?: string;
  bedrooms?: BedroomOption;
  timeline?: string;
  source?: string;
  notes?: string;
  owns_property: boolean;
  owned_property_type?: PropertyType;
  owned_property_area?: string;
  owned_purchase_year?: number;
  owned_purchase_price?: number;
}

export interface CreateInteractionInput {
  lead_id: string;
  agent_id?: string;
  type: InteractionType;
  summary: string;
  outcome?: InteractionOutcome;
  next_action?: string;
  next_action_date?: string;
}

export interface UpdateLeadStageInput {
  stage: Stage;
}

// ============================================================
// Upgrade calculation (apps/crm's upgrade-engine module)
// ============================================================

export interface UpgradeCalculation {
  purchasePrice: number;
  purchaseYear: number;
  propertyType: "apartment" | "villa";
  purchaseIndex: number;
  currentIndex: number;
  estimatedCurrentValue: number;
  equityGained: number;
  equityPercentage: number;
}

// ============================================================
// Dashboard
// ============================================================

export interface DashboardStats {
  totalLeads: number;
  contactedThisWeek: number;
  conversionsThisMonth: number;
  coldLeadsCount: number;
  todayFollowUps: Lead[];
}

// ============================================================
// Goals / trackers (module 10 -- added post-Phase-0 by apps/trackers,
// see packages/shared-db/migrations/001_trackers_goals.sql for the DDL and
// PROGRESS-trackers.md "Notes / decisions made" for why this was promoted
// to the shared package rather than kept apps/trackers-local: revenue and
// activity targets are read by the Today view / monthly report (SPEC.md
// modules 2 and 11), not trackers-only data.
// ============================================================

export const GOAL_SCOPES = ["individual", "team"] as const;
export type GoalScope = (typeof GOAL_SCOPES)[number];

export const GOAL_PERIOD_TYPES = ["daily", "weekly", "monthly", "quarterly", "custom"] as const;
export type GoalPeriodType = (typeof GOAL_PERIOD_TYPES)[number];

export const GOAL_STATUSES = ["active", "completed", "archived"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

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
] as const;
export type RecommendedGoalMetric = (typeof RECOMMENDED_GOAL_METRICS)[number];

export interface Goal {
  id: string;
  scope: GoalScope;
  /** Owning agent for an individual goal; null for a team-wide goal. */
  agent_id: string | null;
  /** Agent who created/assigned the goal -- may differ from agent_id (a manager setting a junior agent's target). */
  created_by: string | null;
  metric: string;
  /** Free-text display unit, e.g. "AED", "calls", "viewings". Purely cosmetic. */
  unit: string | null;
  target_value: number;
  period_type: GoalPeriodType;
  period_start: string;
  period_end: string;
  status: GoalStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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
export const POST_STATUSES = ["draft", "pending_approval", "approved", "held"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok", "google_business"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const POST_KINDS = ["new_listing", "price_update", "sold", "market_update", "brand_general"] as const;
export type PostKind = (typeof POST_KINDS)[number];

/**
 * SPEC.md module 7: "some developers have strict marketing compliance
 * rules" -- own-branded content is unrestricted (subject to the normal
 * approval queue); co_branded content additionally names a developer
 * partner and must be checked against that developer's brand-usage rules
 * before approval (see apps/social-assistant's local DeveloperBrandProfile).
 */
export const BRAND_MODES = ["own", "co_branded"] as const;
export type BrandMode = (typeof BRAND_MODES)[number];

export interface SocialPost {
  id: string;
  kind: PostKind;
  platform: SocialPlatform;
  status: PostStatus;
  brand_mode: BrandMode;
  /** Required when brand_mode = 'co_branded'; null for 'own'. Free text -- see migration header for why this isn't an FK into an app-local table. */
  developer_partner_name: string | null;
  /** FK into shared `properties`, null for posts not tied to a listing (e.g. market_update, brand_general). */
  property_id: string | null;
  caption: string;
  /** Whether `caption` came from the template generator ('template') or a future AI path ('ai'). */
  caption_source: "template" | "ai";
  scheduled_for: string | null;
  /** SPEC.md RBAC role label at creation time -- free text pending real RBAC (see apps/social-assistant's ViewerRole). */
  created_by_role: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  scope: GoalScope;
  agent_id?: string;
  metric: string;
  unit?: string;
  target_value: number;
  period_type: GoalPeriodType;
  period_start: string;
  period_end: string;
  notes?: string;
}

export interface UpdateGoalInput {
  target_value?: number;
  period_start?: string;
  period_end?: string;
  status?: GoalStatus;
  notes?: string;
}

/** One day/session's worth of progress logged against a goal. Entries are additive, not cumulative -- sum them for total progress. */
export interface GoalProgressEntry {
  id: string;
  goal_id: string;
  entry_date: string;
  value: number;
  note: string | null;
  logged_by: string | null;
  created_at: string;
}

export interface CreateGoalProgressEntryInput {
  goal_id: string;
  entry_date: string;
  value: number;
  note?: string;
}

/** Computed, not stored -- returned by the progress view's aggregation query. */
export interface GoalProgress {
  goal: Goal;
  totalLogged: number;
  percentToGoal: number;
  /** Consecutive most-recent days (including today) with at least one progress entry. */
  currentStreakDays: number;
  entryCount: number;
  lastEntryDate: string | null;
}

export interface CreateSocialPostInput {
  kind: PostKind;
  platform: SocialPlatform;
  brand_mode: BrandMode;
  developer_partner_name?: string;
  property_id?: string;
  caption?: string;
  scheduled_for?: string;
  created_by_role: string;
  notes?: string;
}

export const SOCIAL_METRIC_TYPES = [
  "impressions",
  "reach",
  "likes",
  "comments",
  "shares",
  "saves",
  "link_clicks",
] as const;
export type SocialMetricType = (typeof SOCIAL_METRIC_TYPES)[number];

/**
 * Schema/structure only today -- no live posting integration exists, so
 * nothing writes real rows yet. `source` distinguishes a genuine future
 * ingestion ('platform_api') from anything else; never fabricated. See
 * apps/social-assistant/src/lib/data/metrics.ts.
 */
export interface SocialPostMetric {
  id: string;
  post_id: string;
  platform: SocialPlatform;
  metric_type: SocialMetricType;
  value: number;
  source: "platform_api" | "manual_entry";
  recorded_at: string;
}
