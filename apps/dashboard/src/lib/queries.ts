/**
 * Read-only queries against the shared schema (packages/shared-db/schema.sql)
 * for the Today view. Every returned shape is a `@mira/shared-types` row
 * type (or a plain array/record of them) -- nothing here redefines a row
 * shape that already exists in the shared contract (CLAUDE.md).
 *
 * These are plain `SELECT`s, no writes -- this app doesn't have an approval
 * flow of its own to route through (see SPEC.md's review/approval queue,
 * which is Agent Core's, not the dashboard's, to implement).
 */
import { getDb } from "./db";
import type {
  Agent,
  AISuggestion,
  DashboardStats,
  Goal,
  Lead,
  NotificationTier,
  Proposal,
  SocialPost,
  Stage,
} from "@mira/shared-types";
import { NOTIFICATION_TIER_ORDER, STAGES } from "@mira/shared-types";

/**
 * Mirrors apps/crm's src/app/page.tsx definitions (cold = no contact in 7+
 * days; "active" excludes the two terminal stages) so the two dashboards
 * agree on what these numbers mean, translated from crm's legacy `status`
 * filter onto the canonical `stage` column.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();

  const [totalLeadsRes, contactedThisWeekRes, conversionsThisMonthRes, coldLeadsRes, todayFollowUpsRes] =
    await Promise.all([
      db.query<{ count: string }>(
        `select count(*) from leads where stage not in ('won', 'lost')`
      ),
      db.query<{ count: string }>(
        `select count(*) from leads where last_contacted_at >= date_trunc('week', now())`
      ),
      db.query<{ count: string }>(
        `select count(*) from leads where stage = 'won' and updated_at >= date_trunc('month', now())`
      ),
      db.query<{ count: string }>(
        `select count(*) from leads
         where stage not in ('won', 'lost', 'canceled', 'dormant')
           and (last_contacted_at is null or last_contacted_at < now() - interval '7 days')`
      ),
      db.query<Lead>(
        `select * from leads
         where next_followup_at >= date_trunc('day', now())
           and next_followup_at < date_trunc('day', now()) + interval '1 day'
         order by next_followup_at asc`
      ),
    ]);

  return {
    totalLeads: Number(totalLeadsRes.rows[0].count),
    contactedThisWeek: Number(contactedThisWeekRes.rows[0].count),
    conversionsThisMonth: Number(conversionsThisMonthRes.rows[0].count),
    coldLeadsCount: Number(coldLeadsRes.rows[0].count),
    todayFollowUps: todayFollowUpsRes.rows,
  };
}

/** Leads that haven't been contacted in 7+ days and aren't already in a terminal/dormant stage. */
export async function getColdLeads(limit = 10): Promise<Lead[]> {
  const db = getDb();
  const res = await db.query<Lead>(
    `select * from leads
     where stage not in ('won', 'lost', 'canceled', 'dormant')
       and (last_contacted_at is null or last_contacted_at < now() - interval '7 days')
     order by last_contacted_at asc nulls first
     limit $1`,
    [limit]
  );
  return res.rows;
}

/**
 * A tier per item, computed here rather than stored -- neither `proposals`/
 * `ai_suggestions` (Phase 0) nor `social_posts` (apps/social-assistant) has
 * a `tier` column, and this pass deliberately didn't add one to avoid more
 * schema churn (see PROGRESS-integration.md). `NotificationTier` itself
 * *is* shared (promoted from apps/comms-hub's local concept, same
 * decision) -- only the per-type heuristic for computing one is local to
 * whoever's aggregating, same as apps/comms-hub/src/lib/tiers.ts's
 * computeTier() is local to that module's own notion of urgency.
 *
 * Documented v1 heuristics, not a discovered truth -- easy to retune once
 * real usage data exists (same framing as comms-hub's own tier heuristic).
 */
function tierByPendingAge(createdAt: string): NotificationTier {
  const hoursOld = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hoursOld >= 48) return "urgent";
  if (hoursOld >= 12) return "today";
  return "fyi";
}

function tierBySchedule(scheduledFor: string | null): NotificationTier {
  if (!scheduledFor) return "today";
  const hoursUntil = (new Date(scheduledFor).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil <= 24) return "urgent";
  if (hoursUntil <= 24 * 3) return "today";
  return "fyi";
}

/**
 * Minimal local shape for apps/comms-hub's outbound message drafts --
 * deliberately not importing that module's own Message type (CLAUDE.md's
 * module-boundary rule, same reasoning as PipelineTransaction/MouTerm
 * below not being imports either). RESOLVED (was excluded here because
 * comms-hub had no live database, see PROGRESS-integration.md): that app
 * now has a real Postgres-backed store (its own supabase/migrations/
 * 001_comms_hub_schema.sql, applied), so this reads its `messages` table
 * directly, same as every other source in this queue.
 */
export interface CommsDraftSummary {
  id: string;
  threadId: string;
  contactName: string;
  channel: "email" | "whatsapp";
  body: string;
  tier: NotificationTier;
  createdAt: string;
}

export type ReviewQueueItem =
  | { kind: "proposal"; tier: NotificationTier; createdAt: string; data: Proposal }
  | { kind: "suggestion"; tier: NotificationTier; createdAt: string; data: AISuggestion }
  | { kind: "social_post"; tier: NotificationTier; createdAt: string; data: SocialPost }
  | { kind: "comms_draft"; tier: NotificationTier; createdAt: string; data: CommsDraftSummary };

/**
 * Everything currently sitting in the review/approval queue (SPEC.md: "Nearly
 * everything routes here at launch"), merged across every module that has a
 * draft/pending_approval workflow and sorted urgent-first, then oldest-first
 * within a tier. `proposals` + `ai_suggestions` (Phase 0, two tables per the
 * merge decision -- see packages/shared-db/schema.sql's header),
 * `social_posts` (apps/social-assistant), and now `messages` (apps/comms-hub)
 * are all read directly since they're all in the same shared Postgres
 * database -- no cross-app call needed. comms-hub's own `tier` column
 * (already computed there via that module's computeTier(), same heuristic
 * concept as this file's tierByPendingAge/tierBySchedule) is reused as-is
 * rather than recomputed here.
 */
export async function getReviewQueue(): Promise<ReviewQueueItem[]> {
  const db = getDb();
  const [proposalsRes, suggestionsRes, socialPostsRes, commsDraftsRes] = await Promise.all([
    db.query<Proposal>(`select * from proposals where status = 'pending' order by created_at asc`),
    db.query<AISuggestion>(`select * from ai_suggestions where status = 'pending' order by created_at asc`),
    db.query<SocialPost>(`select * from social_posts where status = 'pending_approval' order by created_at asc`),
    db.query<{
      id: string;
      thread_id: string;
      contact_name: string;
      channel: "email" | "whatsapp";
      body: string;
      tier: NotificationTier;
      created_at: string;
    }>(
      `select m.id, m.thread_id, t.contact_name, m.channel, m.body, t.tier, m.created_at
       from messages m
       join message_threads t on t.id = m.thread_id
       where m.direction = 'outbound' and m.status in ('draft', 'pending_approval')
       order by m.created_at asc`
    ),
  ]);

  const items: ReviewQueueItem[] = [
    ...proposalsRes.rows.map(
      (p): ReviewQueueItem => ({ kind: "proposal", tier: tierByPendingAge(p.created_at), createdAt: p.created_at, data: p })
    ),
    ...suggestionsRes.rows.map(
      (s): ReviewQueueItem => ({ kind: "suggestion", tier: tierByPendingAge(s.created_at), createdAt: s.created_at, data: s })
    ),
    ...socialPostsRes.rows.map(
      (p): ReviewQueueItem => ({ kind: "social_post", tier: tierBySchedule(p.scheduled_for), createdAt: p.created_at, data: p })
    ),
    ...commsDraftsRes.rows.map(
      (m): ReviewQueueItem => ({
        kind: "comms_draft",
        tier: m.tier,
        createdAt: m.created_at,
        data: {
          id: m.id,
          threadId: m.thread_id,
          contactName: m.contact_name,
          channel: m.channel,
          body: m.body,
          tier: m.tier,
          createdAt: m.created_at,
        },
      })
    ),
  ];

  items.sort((a, b) => {
    const tierDiff = NOTIFICATION_TIER_ORDER[a.tier] - NOTIFICATION_TIER_ORDER[b.tier];
    if (tierDiff !== 0) return tierDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return items;
}

/** Lead counts per funnel stage, in canonical STAGES order, for a pipeline-shape glance. */
export async function getStageBreakdown(): Promise<Record<Stage, number>> {
  const db = getDb();
  const res = await db.query<{ stage: Stage; count: string }>(
    `select stage, count(*) from leads group by stage`
  );
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const row of res.rows) {
    counts[row.stage] = Number(row.count);
  }
  return counts;
}

export async function getAgents(): Promise<Agent[]> {
  const db = getDb();
  const res = await db.query<Agent>(`select * from agents order by name asc`);
  return res.rows;
}

/** Small lookup map so lead names can be shown next to proposals/suggestions without an N+1. */
export async function getLeadNamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const db = getDb();
  const res = await db.query<{ id: string; name: string }>(
    `select id, name from leads where id = any($1::uuid[])`,
    [ids]
  );
  return new Map(res.rows.map((r) => [r.id, r.name]));
}

// ============================================================
// Cross-module summary widgets (apps/trackers, apps/pipeline,
// apps/inventory). Each reads the shared Postgres database directly, same
// as the Review Queue above -- no cross-app HTTP calls, since the data
// layer is already shared even though the UI layer (Multi-Zones,
// next.config.ts) is not. Row shapes below are deliberately minimal local
// interfaces, not imports from apps/pipeline or apps/inventory's own
// types -- CLAUDE.md's module-boundary rule ("don't reach into another
// module's directory") applies here just as much as it would to importing
// their code; `Goal` is different because it's already promoted into
// @mira/shared-types (see PROGRESS-integration.md), Transaction/MouTerm
// are not.
// ============================================================

export interface TeamGoalProgress {
  goal: Goal;
  totalLogged: number;
  percentToGoal: number;
}

/**
 * Active team-scope goals with their current progress -- mirrors
 * apps/trackers/src/lib/goals.ts's own progress computation (sum of
 * goal_progress_entries.value vs. target_value) closely enough for a
 * summary tile, without importing that module's code.
 */
export async function getTeamGoalsSummary(): Promise<TeamGoalProgress[]> {
  const db = getDb();
  const res = await db.query<Goal & { total_logged: string | null }>(
    `select g.*, (select coalesce(sum(value), 0) from goal_progress_entries where goal_id = g.id) as total_logged
     from goals g
     where g.scope = 'team' and g.status = 'active'
     order by g.period_end asc`
  );
  return res.rows.map((row) => {
    const { total_logged, ...goal } = row;
    const totalLogged = Number(total_logged ?? 0);
    return {
      goal,
      totalLogged,
      percentToGoal: goal.target_value > 0 ? Math.round((totalLogged / goal.target_value) * 100) : 0,
    };
  });
}

export interface PipelineStageCount {
  stage: string;
  count: number;
}

/**
 * Active (non-terminal) transaction counts per stage -- a compact version
 * of apps/pipeline's own kanban board (src/app/page.tsx), for a "deals in
 * motion" glance rather than the full board.
 */
export async function getPipelineSummary(): Promise<{ activeCount: number; byStage: PipelineStageCount[] }> {
  const db = getDb();
  const res = await db.query<{ stage: string; count: string }>(
    `select stage, count(*) from transactions
     where stage not in ('closed_won', 'closed_lost')
     group by stage`
  );
  const byStage = res.rows.map((r) => ({ stage: r.stage, count: Number(r.count) }));
  return { activeCount: byStage.reduce((sum, s) => sum + s.count, 0), byStage };
}

export interface ComplianceAlert {
  mouTermId: string;
  developerPartnerName: string;
  termEnd: string;
  urgency: "overdue" | "expiring_soon";
}

/**
 * MOU terms overdue or expiring within 60 days -- mirrors apps/inventory's
 * own mouUrgency() classification (src/domain/mou.ts) and its
 * listMousOverdue/listMousExpiringSoon queries (src/db/queries.ts), reads
 * only, no write-back here. 60 days matches that module's
 * MOU_EXPIRING_SOON_DAYS constant -- duplicated as a literal here rather
 * than imported, same module-boundary reasoning as the interfaces above.
 */
export async function getComplianceAlerts(): Promise<ComplianceAlert[]> {
  const db = getDb();
  const res = await db.query<{ id: string; name: string; term_end: string; urgency: "overdue" | "expiring_soon" }>(
    `select m.id, dp.name, m.term_end,
       case when m.term_end < current_date then 'overdue' else 'expiring_soon' end as urgency
     from mou_terms m
     join developer_partners dp on dp.id = m.developer_partner_id
     where m.status in ('draft', 'active')
       and m.term_end <= current_date + interval '60 days'
     order by m.term_end asc`
  );
  return res.rows.map((r) => ({
    mouTermId: r.id,
    developerPartnerName: r.name,
    termEnd: r.term_end,
    urgency: r.urgency,
  }));
}
