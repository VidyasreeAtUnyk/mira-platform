/**
 * Core TypeScript types for RealEstateIntel
 * Derived from the Supabase database schema
 */

export type AgentRole = 'agent' | 'manager' | 'admin';

export type LeadType = 'buyer' | 'seller' | 'tenant' | 'landlord';

export type PropertyType = 'apartment' | 'villa' | 'townhouse' | 'commercial' | 'land';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'viewing'
  | 'offer'
  | 'closed_won'
  | 'closed_lost';

export type LeadSource =
  | 'family'
  | 'friend'
  | 'referral'
  | 'bayut'
  | 'property_finder'
  | 'instagram'
  | 'apollo'
  | 'dld'
  | 'walk_in'
  | 'other';

export type InteractionType = 'call' | 'whatsapp' | 'email' | 'viewing' | 'meeting' | 'note';

export type InteractionOutcome = 'positive' | 'neutral' | 'negative' | 'no_answer';

export type SuggestionType = 'followup_message' | 'upgrade_proposal' | 'lead_score';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'sent';

export type BedroomOption = 'studio' | '1' | '2' | '3' | '4+';

// ============================================================
// Database row types
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
  agent_id: string;
  name: string;
  phone: string;
  email: string | null;
  lead_type: LeadType;
  property_type: PropertyType | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  preferred_areas: string[] | null;
  bedrooms: BedroomOption | null;
  status: LeadStatus;
  source: LeadSource | null;
  notes: string | null;
  owns_property: boolean;
  owned_property_type: PropertyType | null;
  owned_property_area: string | null;
  owned_purchase_year: number | null;
  owned_purchase_price: number | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  ai_score: number | null;
  ai_score_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  lead_id: string;
  agent_id: string;
  type: InteractionType;
  summary: string;
  outcome: InteractionOutcome | null;
  next_action: string | null;
  next_action_date: string | null;
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
// Form/API input types
// ============================================================

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  lead_type: LeadType;
  property_type?: PropertyType;
  budget_min?: number;
  budget_max?: number;
  preferred_areas?: string[];
  bedrooms?: BedroomOption;
  source?: LeadSource;
  notes?: string;
  owns_property: boolean;
  owned_property_type?: PropertyType;
  owned_property_area?: string;
  owned_purchase_year?: number;
  owned_purchase_price?: number;
}

export interface CreateInteractionInput {
  lead_id: string;
  type: InteractionType;
  summary: string;
  outcome?: InteractionOutcome;
  next_action?: string;
  next_action_date?: string;
}

export interface UpdateLeadStatusInput {
  status: LeadStatus;
}

// ============================================================
// Upgrade calculation
// ============================================================

export interface UpgradeCalculation {
  purchasePrice: number;
  purchaseYear: number;
  propertyType: 'apartment' | 'villa';
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
