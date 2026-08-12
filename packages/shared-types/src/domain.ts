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
