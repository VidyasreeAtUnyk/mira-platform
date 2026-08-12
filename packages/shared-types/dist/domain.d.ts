import type { Stage, Segment, LegacyCrmStatus } from "./stage.js";
export declare const AGENT_ROLES: readonly ["agent", "manager", "admin"];
export type AgentRole = (typeof AGENT_ROLES)[number];
export declare const LEAD_TYPES: readonly ["buyer", "seller", "tenant", "landlord"];
export type LeadType = (typeof LEAD_TYPES)[number];
export declare const PROPERTY_TYPES: readonly ["apartment", "villa", "townhouse", "commercial", "land"];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export declare const BEDROOM_OPTIONS: readonly ["studio", "1", "2", "3", "4+"];
export type BedroomOption = (typeof BEDROOM_OPTIONS)[number];
/**
 * Recommended values, union of both pre-merge apps' vocabularies -- kept as
 * free text (not a DB CHECK constraint) since lead-source channels are
 * expected to keep growing and a merge is the wrong place to lock that down.
 */
export declare const RECOMMENDED_LEAD_SOURCES: readonly ["family", "friend", "referral", "bayut", "property_finder", "instagram", "apollo", "dld", "walk_in", "other"];
export type RecommendedLeadSource = (typeof RECOMMENDED_LEAD_SOURCES)[number];
/** apps/crm's human-contact-log concept: an agent logging a call/email/etc against a lead. */
export declare const INTERACTION_TYPES: readonly ["call", "whatsapp", "email", "viewing", "meeting", "note"];
export type InteractionType = (typeof INTERACTION_TYPES)[number];
export declare const INTERACTION_OUTCOMES: readonly ["positive", "neutral", "negative", "no_answer"];
export type InteractionOutcome = (typeof INTERACTION_OUTCOMES)[number];
/**
 * apps/lead-agent's passive-signal concept, renamed from its original table
 * name `interactions` to `engagement_events` during the merge to avoid
 * colliding with apps/crm's (semantically different) `interactions` table
 * above. See PROGRESS-phase0.md Notes for why these were kept as two tables
 * instead of one.
 */
export declare const ENGAGEMENT_EVENT_TYPES: readonly ["page_view", "email_open", "reply", "inquiry"];
export type EngagementEventType = (typeof ENGAGEMENT_EVENT_TYPES)[number];
export declare const PROPOSAL_TYPES: readonly ["message", "viewing"];
export type ProposalType = (typeof PROPOSAL_TYPES)[number];
export declare const PROPOSAL_STATUSES: readonly ["pending", "approved", "rejected"];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export declare const SUGGESTION_TYPES: readonly ["followup_message", "upgrade_proposal", "lead_score"];
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];
export declare const SUGGESTION_STATUSES: readonly ["pending", "approved", "rejected", "sent"];
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];
export declare const PROPERTY_TIERS: readonly ["standard", "upgrade"];
export type PropertyTier = (typeof PROPERTY_TIERS)[number];
export declare const AUDIT_ACTORS: readonly ["agent", "human"];
export type AuditActor = (typeof AUDIT_ACTORS)[number];
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
export interface DashboardStats {
    totalLeads: number;
    contactedThisWeek: number;
    conversionsThisMonth: number;
    coldLeadsCount: number;
    todayFollowUps: Lead[];
}
/**
 * Draft-and-hold only, per CLAUDE.md/SPEC.md: nothing marks a post as
 * actually "posted"/"published" because no live posting integration exists,
 * and there shouldn't be one at this stage. Extending this enum with a real
 * "posted" state is a deliberate, reviewed addition for whenever a live
 * posting integration lands -- not something to guess at now.
 */
export declare const POST_STATUSES: readonly ["draft", "pending_approval", "approved", "held"];
export type PostStatus = (typeof POST_STATUSES)[number];
export declare const SOCIAL_PLATFORMS: readonly ["instagram", "facebook", "linkedin", "tiktok", "google_business"];
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export declare const POST_KINDS: readonly ["new_listing", "price_update", "sold", "market_update", "brand_general"];
export type PostKind = (typeof POST_KINDS)[number];
/**
 * SPEC.md module 7: "some developers have strict marketing compliance
 * rules" -- own-branded content is unrestricted (subject to the normal
 * approval queue); co_branded content additionally names a developer
 * partner and must be checked against that developer's brand-usage rules
 * before approval (see apps/social-assistant's local DeveloperBrandProfile).
 */
export declare const BRAND_MODES: readonly ["own", "co_branded"];
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
export declare const SOCIAL_METRIC_TYPES: readonly ["impressions", "reach", "likes", "comments", "shares", "saves", "link_clicks"];
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
