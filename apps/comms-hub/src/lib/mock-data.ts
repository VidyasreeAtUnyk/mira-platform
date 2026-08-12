import type { Message, MessageThread, Notification, Viewer } from '@/types';
import { computeTier } from './tiers';

/**
 * In-memory demo data. This build has no live database connection -- no
 * Supabase credentials exist in this repo (see .env.example) -- so the
 * "unified inbox" is seeded here rather than read from Postgres. Shaped to
 * match supabase/migrations/001_comms_hub_schema.sql exactly, so swapping
 * this module for a real `src/lib/data/store.ts` backed by
 * @supabase/supabase-js later is a storage-layer change, not a type change.
 *
 * Deliberately includes at least one example of every RBAC-relevant case
 * (lead-linked, non-CRM-linked, compliance-tagged, different owning
 * agents) so src/lib/rbac.ts's filtering can be demoed/eyeballed against
 * real-shaped data, especially the Marketing/Social "no CRM/lead access"
 * requirement from SPEC.md.
 */

// ============================================================
// Demo viewers -- one per SPEC.md RBAC role, for the role switcher
// ============================================================
export const DEMO_VIEWERS: Viewer[] = [
  { agentId: 'agent-owner', displayName: 'Vidya (Owner/COO)', role: 'owner_coo' },
  { agentId: 'agent-senior-1', displayName: 'Rahul (Senior Agent)', role: 'senior_agent' },
  { agentId: 'agent-junior-1', displayName: 'Zara (Junior Agent)', role: 'junior_agent' },
  { agentId: 'agent-marketing-1', displayName: 'Meera (Marketing/Social)', role: 'marketing_social' },
  { agentId: 'agent-admin-1', displayName: 'Farhan (Admin/Ops)', role: 'admin_ops' },
  { agentId: 'agent-finance-1', displayName: 'Owner (Finance view)', role: 'finance' },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

// ============================================================
// Threads (tier is computed below from each thread's latest message, not
// hand-set, so the seed can't drift from the tier heuristic in tiers.ts)
// ============================================================
interface SeedThread extends Omit<MessageThread, 'tier'> {
  leadStage?: 'new' | 'contacted' | 'qualified' | 'viewing_scheduled' | 'decision_pending' | 'won' | 'lost' | 'canceled' | 'dormant';
  doNotContact?: boolean;
}

const seedThreads: SeedThread[] = [
  {
    id: 'thread-1',
    channel: 'whatsapp',
    subject: null,
    contactName: 'Amir Hassan',
    contactHandle: '+971501234567',
    leadId: 'lead-1',
    agentId: 'agent-senior-1',
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(0.5),
    createdAt: hoursAgo(48),
    leadStage: 'decision_pending',
  },
  {
    id: 'thread-2',
    channel: 'email',
    subject: 'Re: Marina view unit — viewing this weekend?',
    contactName: 'Priya Nair',
    contactHandle: 'priya.nair@example.com',
    leadId: 'lead-2',
    agentId: 'agent-junior-1',
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(4),
    createdAt: hoursAgo(72),
    leadStage: 'viewing_scheduled',
  },
  {
    id: 'thread-3',
    channel: 'whatsapp',
    subject: null,
    contactName: 'Karan Mehta',
    contactHandle: '+971509876543',
    leadId: 'lead-3',
    agentId: 'agent-senior-1',
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(20),
    createdAt: hoursAgo(120),
    leadStage: 'qualified',
  },
  {
    id: 'thread-4',
    channel: 'email',
    subject: 'Budget update',
    contactName: 'Fatima Al Suwaidi',
    contactHandle: 'fatima.a@example.com',
    leadId: 'lead-4',
    agentId: 'agent-junior-1',
    tags: [],
    unread: false,
    lastMessageAt: hoursAgo(96),
    createdAt: hoursAgo(200),
    leadStage: 'contacted',
  },
  {
    id: 'thread-5',
    channel: 'whatsapp',
    subject: null,
    contactName: 'Old lead — do not contact',
    contactHandle: '+971507654321',
    leadId: 'lead-5',
    agentId: 'agent-senior-1',
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(1),
    createdAt: hoursAgo(400),
    leadStage: 'lost',
    doNotContact: true,
  },
  {
    id: 'thread-6',
    channel: 'email',
    subject: 'Partnership inquiry — real estate photography',
    contactName: 'Studio Lumen',
    contactHandle: 'hello@studiolumen.example',
    leadId: null,
    agentId: null,
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(6),
    createdAt: hoursAgo(6),
  },
  {
    id: 'thread-7',
    channel: 'email',
    subject: 'RERA disclosure form — signature needed',
    contactName: 'Compliance Desk',
    contactHandle: 'compliance@example.com',
    leadId: null,
    agentId: 'agent-owner',
    tags: ['compliance'],
    unread: true,
    lastMessageAt: hoursAgo(3),
    createdAt: hoursAgo(30),
  },
];

const seedMessages: Message[] = [
  // thread-1 (whatsapp, decision_pending -> urgent by stage)
  {
    id: 'msg-1a', threadId: 'thread-1', channel: 'whatsapp', direction: 'inbound', status: 'sent',
    body: "Hi, we've decided — can we move forward with the Marina unit? What's next?",
    from: '+971501234567', to: '+971500000001', bspProvider: 'mock', emailProvider: null,
    heldReason: null, approvedBy: null, createdAt: hoursAgo(0.5),
  },
  {
    id: 'msg-1b', threadId: 'thread-1', channel: 'whatsapp', direction: 'outbound', status: 'draft',
    body: "That's great news! I'll send over the reservation form and next steps shortly.",
    from: '+971500000001', to: '+971501234567', bspProvider: null, emailProvider: null,
    heldReason: null, approvedBy: null, createdAt: hoursAgo(0.4),
  },
  // thread-2 (email, viewing_scheduled)
  {
    id: 'msg-2a', threadId: 'thread-2', channel: 'email', direction: 'inbound', status: 'sent',
    body: 'Does Saturday 11am still work for the viewing?',
    from: 'priya.nair@example.com', to: 'agent@example.com', bspProvider: null, emailProvider: 'mock',
    heldReason: null, approvedBy: null, createdAt: hoursAgo(4),
  },
  // thread-3 (whatsapp, qualified, unread 20h -> "today")
  {
    id: 'msg-3a', threadId: 'thread-3', channel: 'whatsapp', direction: 'inbound', status: 'sent',
    body: 'Can you send more floor plans for the 2-bed options?',
    from: '+971509876543', to: '+971500000001', bspProvider: 'mock', emailProvider: null,
    heldReason: null, approvedBy: null, createdAt: hoursAgo(20),
  },
  // thread-4 (email, read -> fyi)
  {
    id: 'msg-4a', threadId: 'thread-4', channel: 'email', direction: 'inbound', status: 'sent',
    body: 'Our budget ceiling moved up slightly to 2.4M AED.',
    from: 'fatima.a@example.com', to: 'agent@example.com', bspProvider: null, emailProvider: 'mock',
    heldReason: null, approvedBy: null, createdAt: hoursAgo(96),
  },
  {
    id: 'msg-4b', threadId: 'thread-4', channel: 'email', direction: 'outbound', status: 'held',
    body: 'Draft reply prepared, held pending agent review before send.',
    from: 'agent@example.com', to: 'fatima.a@example.com', bspProvider: null, emailProvider: 'mock',
    heldReason: 'No live email provider configured -- message held for manual approval, not sent.',
    approvedBy: null, createdAt: hoursAgo(90),
  },
  // thread-5 (do_not_contact -> forced fyi despite being unread+recent)
  {
    id: 'msg-5a', threadId: 'thread-5', channel: 'whatsapp', direction: 'inbound', status: 'sent',
    body: 'STOP contacting me.',
    from: '+971507654321', to: '+971500000001', bspProvider: 'mock', emailProvider: null,
    heldReason: null, approvedBy: null, createdAt: hoursAgo(1),
  },
  // thread-6 (non-CRM-linked, visible to Marketing/Social)
  {
    id: 'msg-6a', threadId: 'thread-6', channel: 'email', direction: 'inbound', status: 'sent',
    body: 'We do professional real estate photography — would love to collaborate on listing shoots.',
    from: 'hello@studiolumen.example', to: 'marketing@example.com', bspProvider: null, emailProvider: 'mock',
    heldReason: null, approvedBy: null, createdAt: hoursAgo(6),
  },
  // thread-7 (compliance-tagged, non-CRM-linked, visible to Admin/Ops)
  {
    id: 'msg-7a', threadId: 'thread-7', channel: 'email', direction: 'inbound', status: 'sent',
    body: 'Please countersign and return the updated RERA disclosure form by Friday.',
    from: 'compliance@example.com', to: 'owner@example.com', bspProvider: null, emailProvider: 'mock',
    heldReason: null, approvedBy: null, createdAt: hoursAgo(3),
  },
];

function latestMessageFor(threadId: string): Message | null {
  const msgs = seedMessages.filter((m) => m.threadId === threadId);
  if (msgs.length === 0) return null;
  return msgs.reduce((latest, m) => (new Date(m.createdAt) > new Date(latest.createdAt) ? m : latest));
}

export const THREADS: MessageThread[] = seedThreads.map((t) => {
  const { leadStage, doNotContact, ...thread } = t;
  return {
    ...thread,
    tier: computeTier({
      threadUnread: thread.unread,
      latestMessage: latestMessageFor(thread.id),
      leadStage,
      doNotContact,
    }),
  };
});

export const MESSAGES: Message[] = seedMessages;

export const NOTIFICATIONS: Notification[] = THREADS.map((t) => {
  const latest = latestMessageFor(t.id);
  return {
    id: `notif-${t.id}`,
    tier: t.tier,
    title: t.channel === 'whatsapp' ? `WhatsApp — ${t.contactName}` : `Email — ${t.contactName}`,
    body: latest ? latest.body.slice(0, 120) : 'New thread',
    threadId: t.id,
    createdAt: t.lastMessageAt,
    read: !t.unread,
  };
});
