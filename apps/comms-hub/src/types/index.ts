/**
 * apps/comms-hub's type surface.
 *
 * Re-exports the Phase 0 shared contract from @mira/shared-types (do not
 * redefine Lead/Agent/etc. locally -- see CLAUDE.md's "don't redefine types
 * that already exist there" rule) and adds the comms-hub-specific unified
 * message/thread/notification model, which has no shared-schema equivalent
 * yet -- see supabase/migrations/001_comms_hub_schema.sql for the intended
 * Postgres shape this mirrors.
 */
export * from '@mira/shared-types';

// ============================================================
// Channels
// ============================================================
export const CHANNELS = ['email', 'whatsapp'] as const;
export type Channel = (typeof CHANNELS)[number];

export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

/**
 * draft -> pending_approval -> approved -> sent, with `held` reachable from
 * any pre-sent state. `sent` is reachable in the *model* (inbound messages
 * a contact already sent us arrive pre-populated in this state -- that's
 * their action, not ours) but no code path in this build ever transitions
 * an *outbound* message to `sent`: src/lib/bsp and src/lib/email adapters
 * only ever resolve to `held`. Draft-and-hold is enforced in code, not just
 * left to convention, per CLAUDE.md's "no live sends" rule.
 */
export const MESSAGE_STATUSES = ['draft', 'pending_approval', 'approved', 'held', 'sent'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const NOTIFICATION_TIERS = ['urgent', 'today', 'fyi'] as const;
export type NotificationTier = (typeof NOTIFICATION_TIERS)[number];

export const BSP_PROVIDERS = ['interakt', 'wati', 'twilio', 'mock'] as const;
export type BspProvider = (typeof BSP_PROVIDERS)[number];

export const EMAIL_PROVIDERS = ['gmail', 'outlook', 'mock'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

/**
 * SPEC.md's RBAC table ("Roles (RBAC + ownership)") is richer than
 * @mira/shared-types' `AgentRole` ('agent' | 'manager' | 'admin' -- the
 * Phase 0 CRM auth role only, see packages/shared-db/schema.sql's `agents`
 * table). Comms-hub notification/thread filtering needs the full SPEC
 * table -- Marketing/Social's explicit "No CRM/lead access" note is the one
 * concrete, testable requirement this build targets -- so `CommsRole`
 * exists here as a business-role axis distinct from (not a fork of)
 * AgentRole's CRM-auth-role axis.
 *
 * This is flagged in PROGRESS-comms.md for a human to decide whether
 * CommsRole should be promoted into packages/shared-types (and `agents`
 * given a real role/team model) in the cross-module integration pass --
 * out of scope for this branch, which must not touch packages/*.
 */
export const COMMS_ROLES = [
  'owner_coo',
  'senior_agent',
  'junior_agent',
  'marketing_social',
  'admin_ops',
  'finance',
] as const;
export type CommsRole = (typeof COMMS_ROLES)[number];

/** A logged-in user of comms-hub, for RBAC filtering purposes. */
export interface Viewer {
  agentId: string;
  displayName: string;
  role: CommsRole;
}

export interface MessageThread {
  id: string;
  channel: Channel;
  subject: string | null;
  contactName: string;
  /** E.164 phone for whatsapp threads, email address for email threads. */
  contactHandle: string;
  /** FK -> shared `leads.id`. Null for non-CRM-linked comms. */
  leadId: string | null;
  /** FK -> shared `agents.id`. The owning/assigned agent, if any. */
  agentId: string | null;
  /** e.g. 'compliance' -- used by Admin/Ops visibility rules. */
  tags: string[];
  tier: NotificationTier;
  unread: boolean;
  lastMessageAt: string;
  createdAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  channel: Channel;
  direction: MessageDirection;
  status: MessageStatus;
  body: string;
  from: string;
  to: string;
  /** Set only for channel === 'whatsapp'. */
  bspProvider: BspProvider | null;
  /** Set only for channel === 'email'. */
  emailProvider: EmailProvider | null;
  heldReason: string | null;
  /** agentId of whoever approved this draft, if approved. */
  approvedBy: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  tier: NotificationTier;
  title: string;
  body: string;
  /** Null for platform-wide notices not tied to a specific thread. */
  threadId: string | null;
  createdAt: string;
  read: boolean;
}
