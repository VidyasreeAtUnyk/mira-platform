/**
 * Real Postgres reads/writes for comms-hub's own tables (message_threads/
 * messages/notifications, supabase/migrations/001_comms_hub_schema.sql),
 * replacing what used to be src/components/comms-store.tsx's in-memory
 * mock state (see PROGRESS-integration.md for the full writeup).
 *
 * Every mutation here still only ever writes status: 'draft' for outbound
 * messages -- nothing in this file calls src/lib/bsp or src/lib/email's
 * adapters, and nothing sets an outbound message to 'sent'. That keeps
 * "no send path exists end-to-end" true by construction, same guarantee
 * the old in-memory store made, just backed by a real database now.
 */
import { getDb } from "@/lib/db";
import { computeTier } from "@/lib/tiers";
import type { AgentRole, Channel, Lead, Message, MessageThread, Notification, Viewer } from "@/types";

interface MessageThreadRow {
  id: string;
  channel: Channel;
  subject: string | null;
  contact_name: string;
  contact_handle: string;
  lead_id: string | null;
  agent_id: string | null;
  tags: string[];
  tier: MessageThread["tier"];
  unread: boolean;
  last_message_at: string;
  created_at: string;
}

function mapThread(row: MessageThreadRow): MessageThread {
  return {
    id: row.id,
    channel: row.channel,
    subject: row.subject,
    contactName: row.contact_name,
    contactHandle: row.contact_handle,
    leadId: row.lead_id,
    agentId: row.agent_id,
    tags: row.tags,
    tier: row.tier,
    unread: row.unread,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  };
}

interface MessageRow {
  id: string;
  thread_id: string;
  channel: Channel;
  direction: Message["direction"];
  status: Message["status"];
  body: string;
  from_handle: string;
  to_handle: string;
  bsp_provider: Message["bspProvider"];
  email_provider: Message["emailProvider"];
  held_reason: string | null;
  approved_by: string | null;
  created_at: string;
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    channel: row.channel,
    direction: row.direction,
    status: row.status,
    body: row.body,
    from: row.from_handle,
    to: row.to_handle,
    bspProvider: row.bsp_provider,
    emailProvider: row.email_provider,
    heldReason: row.held_reason,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
  };
}

interface NotificationRow {
  id: string;
  tier: Notification["tier"];
  title: string;
  body: string;
  thread_id: string | null;
  read: boolean;
  created_at: string;
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    tier: row.tier,
    title: row.title,
    body: row.body,
    threadId: row.thread_id,
    read: row.read,
    createdAt: row.created_at,
  };
}

export async function listThreads(): Promise<MessageThread[]> {
  const db = getDb();
  const res = await db.query<MessageThreadRow>(`select * from message_threads order by last_message_at desc`);
  return res.rows.map(mapThread);
}

export async function listMessages(): Promise<Message[]> {
  const db = getDb();
  const res = await db.query<MessageRow>(`select * from messages order by created_at asc`);
  return res.rows.map(mapMessage);
}

export async function listNotifications(): Promise<Notification[]> {
  const db = getDb();
  const res = await db.query<NotificationRow>(`select * from notifications order by created_at desc`);
  return res.rows.map(mapNotification);
}

/**
 * "Logged-in user" stand-in for the role switcher -- reads real agents
 * from the shared `agents` table (the same rows every other module's seed
 * script creates), not a hardcoded demo list. THIS IS NOT AUTH (same
 * caveat every other module's viewer-switcher stand-in carries) -- there
 * is no session, this just lets you pick which real agent you're viewing
 * comms-hub as.
 */
export async function listViewers(): Promise<Viewer[]> {
  const db = getDb();
  const res = await db.query<{ id: string; name: string; role: AgentRole }>(
    `select id, name, role from agents order by
       case role when 'owner_coo' then 0 else 1 end, name asc`
  );
  return res.rows.map((r) => ({ agentId: r.id, displayName: r.name, role: r.role }));
}

/**
 * Recomputes a thread's tier the same way it was originally seeded
 * (src/lib/tiers.ts's computeTier -- single source of truth, not
 * duplicated), looking up the linked lead's stage/do_not_contact when the
 * thread is CRM-linked so the "do_not_contact leads are never urgent" and
 * stage-based urgency rules still apply after a real mutation, not just
 * at seed time.
 */
async function computeAndPersistTier(threadId: string): Promise<void> {
  const db = getDb();
  const threadRes = await db.query<{ id: string; lead_id: string | null; unread: boolean }>(
    `select id, lead_id, unread from message_threads where id = $1`,
    [threadId]
  );
  const thread = threadRes.rows[0];
  if (!thread) return;

  const latestRes = await db.query<{ direction: Message["direction"]; created_at: string }>(
    `select direction, created_at from messages where thread_id = $1 order by created_at desc limit 1`,
    [threadId]
  );
  const latest = latestRes.rows[0]
    ? { direction: latestRes.rows[0].direction, createdAt: latestRes.rows[0].created_at }
    : null;

  let leadStage: Lead["stage"] | null = null;
  let doNotContact = false;
  if (thread.lead_id) {
    const leadRes = await db.query<{ stage: Lead["stage"]; do_not_contact: boolean }>(
      `select stage, do_not_contact from leads where id = $1`,
      [thread.lead_id]
    );
    if (leadRes.rows[0]) {
      leadStage = leadRes.rows[0].stage;
      doNotContact = leadRes.rows[0].do_not_contact;
    }
  }

  const tier = computeTier({
    threadUnread: thread.unread,
    latestMessage: latest,
    leadStage,
    doNotContact,
  });

  await db.query(`update message_threads set tier = $2 where id = $1`, [threadId, tier]);
}

/**
 * Resolves a thread's `leadId` to a display name (+ contact), for the
 * thread detail page -- was rendering the raw uuid as "Linked to lead
 * <uuid>" (see PROGRESS-comms.md), which is real data but not readable.
 * Not a Link to anywhere: this app has no reachable lead-detail route in
 * the current Multi-Zones setup (apps/dashboard's rewrites only proxy
 * pipeline/trackers/social/comms, not apps/crm) -- so this is a name
 * lookup, not (yet) a navigation target.
 */
export async function getLeadSummary(leadId: string): Promise<{ name: string; phone: string | null; email: string | null } | null> {
  const db = getDb();
  const res = await db.query<{ name: string; phone: string | null; email: string | null }>(
    `select name, phone, email from leads where id = $1`,
    [leadId]
  );
  return res.rows[0] ?? null;
}

export async function markThreadRead(threadId: string): Promise<void> {
  const db = getDb();
  await db.query(`update message_threads set unread = false where id = $1 and unread = true`, [threadId]);
  await db.query(`update notifications set read = true where thread_id = $1`, [threadId]);
  await computeAndPersistTier(threadId);
}

const AGENCY_EMAIL_ADDRESS = "agent@example.com";
const AGENCY_WHATSAPP_NUMBER = "+971500000001";

/** Appends a status: 'draft' outbound message to an existing thread. Never anything else. */
export async function addReplyDraft(threadId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (trimmed.length === 0) return;
  const db = getDb();
  const threadRes = await db.query<{ channel: Channel; contact_handle: string }>(
    `select channel, contact_handle from message_threads where id = $1`,
    [threadId]
  );
  const thread = threadRes.rows[0];
  if (!thread) return;

  await db.query(
    `insert into messages (thread_id, channel, direction, status, body, from_handle, to_handle)
     values ($1, $2, 'outbound', 'draft', $3, $4, $5)`,
    [
      threadId,
      thread.channel,
      trimmed,
      thread.channel === "whatsapp" ? AGENCY_WHATSAPP_NUMBER : AGENCY_EMAIL_ADDRESS,
      thread.contact_handle,
    ]
  );
  // last_message_at is handled by the migration's own trigger
  // (update_thread_last_message) -- only tier needs recomputing here.
  await computeAndPersistTier(threadId);
}

export interface NewThreadInput {
  channel: Channel;
  contactName: string;
  contactHandle: string;
  subject: string | null;
  body: string;
  agentId: string | null;
}

/** Creates a new thread with one status: 'draft' outbound message. Never anything else. */
export async function createDraftThread(input: NewThreadInput): Promise<string> {
  const db = getDb();
  const threadRes = await db.query<{ id: string }>(
    `insert into message_threads (channel, subject, contact_name, contact_handle, agent_id, unread, tier)
     values ($1, $2, $3, $4, $5, false, 'fyi')
     returning id`,
    [
      input.channel,
      input.channel === "email" ? input.subject : null,
      input.contactName.trim(),
      input.contactHandle.trim(),
      input.agentId,
    ]
  );
  const threadId = threadRes.rows[0].id;

  await db.query(
    `insert into messages (thread_id, channel, direction, status, body, from_handle, to_handle)
     values ($1, $2, 'outbound', 'draft', $3, $4, $5)`,
    [
      threadId,
      input.channel,
      input.body.trim(),
      input.channel === "whatsapp" ? AGENCY_WHATSAPP_NUMBER : AGENCY_EMAIL_ADDRESS,
      input.contactHandle.trim(),
    ]
  );

  return threadId;
}
