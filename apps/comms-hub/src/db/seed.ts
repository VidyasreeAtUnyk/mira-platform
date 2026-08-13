/**
 * Dev seed for comms-hub's own tables. Deletes only this script's own
 * previously-seeded rows (by a natural identifier -- contact_handle),
 * never a blanket TRUNCATE of shared tables -- see apps/pipeline's
 * src/scripts/seed.ts (fixed this session, PROGRESS-integration.md) for
 * why that matters when running against a database other seed scripts
 * also write to.
 *
 * Links to REAL leads/agents in the shared database (queried by name,
 * not hardcoded ids -- those differ per environment/reseed) rather than
 * the placeholder 'lead-1'-style ids the old in-memory mock data used,
 * which were never real foreign keys. One lead is marked
 * do_not_contact = true here (a real, if unusual, write to a shared
 * table -- not a schema change) to replicate the DNC tier-override demo
 * case the original design specifically wanted to exercise.
 */
import { fileURLToPath } from "node:url";
import { getDb } from "../lib/db";
import { computeTier } from "../lib/tiers";
import type { Lead } from "../types";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

interface SeedThreadInput {
  channel: "whatsapp" | "email";
  subject: string | null;
  contactName: string;
  contactHandle: string;
  leadName: string | null;
  agentName: string | null;
  tags: string[];
  unread: boolean;
  lastMessageAt: string;
  createdAt: string;
}

interface SeedMessageInput {
  contactHandle: string; // which thread this belongs to, by its contact_handle
  direction: "inbound" | "outbound";
  status: "draft" | "held" | "sent";
  body: string;
  createdAt: string;
  heldReason?: string;
}

const SEED_THREADS: SeedThreadInput[] = [
  {
    channel: "whatsapp",
    subject: null,
    contactName: "James Okafor",
    contactHandle: "+971555678901",
    leadName: "James Okafor",
    agentName: "Ahmed Al-Rashidi",
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(0.5),
    createdAt: hoursAgo(48),
  },
  {
    channel: "email",
    subject: "Re: Marina view unit — viewing this weekend?",
    contactName: "Anna Kowalski",
    contactHandle: "anna.k@example.com",
    leadName: "Anna Kowalski",
    agentName: "Ahmed Al-Rashidi",
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(4),
    createdAt: hoursAgo(72),
  },
  {
    channel: "whatsapp",
    subject: null,
    contactName: "Priya Patel",
    contactHandle: "+971556789012",
    leadName: "Priya Patel",
    agentName: "Ahmed Al-Rashidi",
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(20),
    createdAt: hoursAgo(120),
  },
  {
    channel: "email",
    subject: "Budget update",
    contactName: "Elena Petrov",
    contactHandle: "elena.petrov@example.com",
    leadName: "Elena Petrov",
    agentName: "Sarah Mitchell",
    tags: [],
    unread: false,
    lastMessageAt: hoursAgo(96),
    createdAt: hoursAgo(200),
  },
  {
    channel: "whatsapp",
    subject: null,
    contactName: "Khalid Al-Mansoori — do not contact",
    contactHandle: "+971557890123",
    leadName: "Khalid Al-Mansoori",
    agentName: "Ahmed Al-Rashidi",
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(1),
    createdAt: hoursAgo(400),
  },
  {
    channel: "email",
    subject: "Partnership inquiry — real estate photography",
    contactName: "Studio Lumen",
    contactHandle: "hello@studiolumen.example",
    leadName: null,
    agentName: null,
    tags: [],
    unread: true,
    lastMessageAt: hoursAgo(6),
    createdAt: hoursAgo(6),
  },
  {
    channel: "email",
    subject: "RERA disclosure form — signature needed",
    contactName: "Compliance Desk",
    contactHandle: "compliance@example.com",
    leadName: null,
    agentName: "Sarah Mitchell",
    tags: ["compliance"],
    unread: true,
    lastMessageAt: hoursAgo(3),
    createdAt: hoursAgo(30),
  },
];

const SEED_MESSAGES: SeedMessageInput[] = [
  {
    contactHandle: "+971555678901",
    direction: "inbound",
    status: "sent",
    body: "Hi, we've decided — can we move forward with the Marina unit? What's next?",
    createdAt: hoursAgo(0.5),
  },
  {
    contactHandle: "+971555678901",
    direction: "outbound",
    status: "draft",
    body: "That's great news! I'll send over the reservation form and next steps shortly.",
    createdAt: hoursAgo(0.4),
  },
  {
    contactHandle: "anna.k@example.com",
    direction: "inbound",
    status: "sent",
    body: "Does Saturday 11am still work for the viewing?",
    createdAt: hoursAgo(4),
  },
  {
    contactHandle: "+971556789012",
    direction: "inbound",
    status: "sent",
    body: "Can you send more floor plans for the 2-bed options?",
    createdAt: hoursAgo(20),
  },
  {
    contactHandle: "elena.petrov@example.com",
    direction: "inbound",
    status: "sent",
    body: "Our budget ceiling moved up slightly to 2.4M AED.",
    createdAt: hoursAgo(96),
  },
  {
    contactHandle: "elena.petrov@example.com",
    direction: "outbound",
    status: "held",
    body: "Draft reply prepared, held pending agent review before send.",
    createdAt: hoursAgo(90),
    heldReason: "No live email provider configured -- message held for manual approval, not sent.",
  },
  {
    contactHandle: "+971557890123",
    direction: "inbound",
    status: "sent",
    body: "STOP contacting me.",
    createdAt: hoursAgo(1),
  },
  {
    contactHandle: "hello@studiolumen.example",
    direction: "inbound",
    status: "sent",
    body: "We do professional real estate photography — would love to collaborate on listing shoots.",
    createdAt: hoursAgo(6),
  },
  {
    contactHandle: "compliance@example.com",
    direction: "inbound",
    status: "sent",
    body: "Please countersign and return the updated RERA disclosure form by Friday.",
    createdAt: hoursAgo(3),
  },
];

/**
 * No other module's seed script creates agents in these 4 roles -- every
 * real agent in the shared table so far is owner_coo or junior_agent
 * (apps/pipeline, apps/trackers, apps/crm's original seed). Without at
 * least one agent per role, the role switcher can't actually exercise
 * src/lib/rbac.ts's per-role rules -- especially the Marketing/Social
 * "no CRM/lead access" exclusion, which is the one rule SPEC.md states
 * explicitly and this module's whole RBAC design exists to demonstrate.
 * Upserted by email (idempotent across reseeds), not truncated -- these
 * are real rows in a shared table other modules may also reference.
 */
const DEMO_ROLE_AGENTS = [
  { name: "Rahul Kapoor", email: "rahul.kapoor@mira.example", role: "senior_agent" },
  { name: "Meera Iyer", email: "meera.iyer@mira.example", role: "marketing_social" },
  { name: "Farhan Sheikh", email: "farhan.sheikh@mira.example", role: "admin_ops" },
  { name: "Divya Menon", email: "divya.menon@mira.example", role: "finance" },
] as const;

async function ensureDemoRoleAgents(): Promise<void> {
  const db = getDb();
  for (const a of DEMO_ROLE_AGENTS) {
    await db.query(
      `insert into agents (name, email, role) values ($1, $2, $3)
       on conflict (email) do update set role = excluded.role`,
      [a.name, a.email, a.role]
    );
  }
}

async function seedDatabase() {
  const db = getDb();

  await ensureDemoRoleAgents();

  const handles = SEED_THREADS.map((t) => t.contactHandle);
  await db.query(
    `delete from messages where thread_id in (select id from message_threads where contact_handle = any($1::text[]))`,
    [handles]
  );
  await db.query(`delete from notifications where thread_id in (select id from message_threads where contact_handle = any($1::text[]))`, [
    handles,
  ]);
  await db.query(`delete from message_threads where contact_handle = any($1::text[])`, [handles]);

  // The one real write to a shared table this seed makes: mark Khalid
  // Al-Mansoori do_not_contact, to demo the "DNC leads are never urgent
  // regardless of activity" tier rule (src/lib/tiers.ts's computeTier).
  await db.query(`update leads set do_not_contact = true where name = 'Khalid Al-Mansoori'`);

  const leadIds = new Map<string, { id: string; stage: Lead["stage"]; do_not_contact: boolean }>();
  const leadRes = await db.query<{ id: string; name: string; stage: Lead["stage"]; do_not_contact: boolean }>(
    `select id, name, stage, do_not_contact from leads where name = any($1::text[])`,
    [SEED_THREADS.map((t) => t.leadName).filter((n): n is string => n !== null)]
  );
  for (const row of leadRes.rows) leadIds.set(row.name, row);

  const agentIds = new Map<string, string>();
  const agentRes = await db.query<{ id: string; name: string }>(
    `select id, name from agents where name = any($1::text[])`,
    [SEED_THREADS.map((t) => t.agentName).filter((n): n is string => n !== null)]
  );
  for (const row of agentRes.rows) agentIds.set(row.name, row.id);

  const threadIdByHandle = new Map<string, string>();
  for (const t of SEED_THREADS) {
    const lead = t.leadName ? leadIds.get(t.leadName) : undefined;
    const agentId = t.agentName ? (agentIds.get(t.agentName) ?? null) : null;

    const threadMessages = SEED_MESSAGES.filter((m) => m.contactHandle === t.contactHandle);
    const latest = threadMessages.length
      ? threadMessages.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a))
      : null;
    const tier = computeTier({
      threadUnread: t.unread,
      latestMessage: latest ? { direction: latest.direction, createdAt: latest.createdAt } : null,
      leadStage: lead?.stage ?? null,
      doNotContact: lead?.do_not_contact ?? false,
    });

    const res = await db.query<{ id: string }>(
      `insert into message_threads
        (channel, subject, contact_name, contact_handle, lead_id, agent_id, tags, tier, unread, last_message_at, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id`,
      [
        t.channel,
        t.subject,
        t.contactName,
        t.contactHandle,
        lead?.id ?? null,
        agentId,
        t.tags,
        tier,
        t.unread,
        t.lastMessageAt,
        t.createdAt,
      ]
    );
    threadIdByHandle.set(t.contactHandle, res.rows[0].id);
  }

  for (const m of SEED_MESSAGES) {
    const threadId = threadIdByHandle.get(m.contactHandle);
    if (!threadId) continue;
    const thread = SEED_THREADS.find((t) => t.contactHandle === m.contactHandle)!;
    const fromHandle =
      m.direction === "inbound" ? m.contactHandle : thread.channel === "whatsapp" ? "+971500000001" : "agent@example.com";
    const toHandle =
      m.direction === "inbound" ? (thread.channel === "whatsapp" ? "+971500000001" : "agent@example.com") : m.contactHandle;

    await db.query(
      `insert into messages (thread_id, channel, direction, status, body, from_handle, to_handle, held_reason, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [threadId, thread.channel, m.direction, m.status, m.body, fromHandle, toHandle, m.heldReason ?? null, m.createdAt]
    );
  }

  // One notification per seeded thread, mirroring what the old mock data derived automatically.
  for (const t of SEED_THREADS) {
    const threadId = threadIdByHandle.get(t.contactHandle);
    if (!threadId) continue;
    const threadMessages = SEED_MESSAGES.filter((m) => m.contactHandle === t.contactHandle);
    const latest = threadMessages.length
      ? threadMessages.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a))
      : null;
    const threadRow = await db.query<{ tier: string }>(`select tier from message_threads where id = $1`, [threadId]);

    await db.query(
      `insert into notifications (tier, title, body, thread_id, read, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        threadRow.rows[0].tier,
        t.channel === "whatsapp" ? `WhatsApp — ${t.contactName}` : `Email — ${t.contactName}`,
        latest ? latest.body.slice(0, 120) : "New thread",
        threadId,
        !t.unread,
        t.lastMessageAt,
      ]
    );
  }

  return { threadIds: Object.fromEntries(threadIdByHandle) };
}

async function main() {
  const result = await seedDatabase();
  console.log("Seeded comms-hub database.");
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
