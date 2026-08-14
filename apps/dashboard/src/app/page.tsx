/**
 * Today view -- the dashboard's home screen (SPEC.md: "the agent's current
 * briefing ... this is the home screen"). Server component: reads `?role=`
 * (UI-only, see src/lib/roles.ts -- NOT auth), then queries the shared
 * schema directly via src/lib/queries.ts for real counts/leads. Nothing here
 * is mocked -- an empty section means the underlying query genuinely
 * returned nothing.
 *
 * RESOLVED (was a stat-tile-and-list wall, see git history): rebuilt around
 * a single-screen narrative brief (src/lib/brief.ts) per direct user
 * feedback -- a human-readable "what happened / what's happening / what
 * needs attention" instead of a dashboard of numbers, with a separate
 * Planned tab for what's coming, and a real link to source detail
 * wherever one exists in the Multi-Zones setup today. The brief itself is
 * template-composed from real data (no AI call needed -- same reasoning
 * as social-assistant's caption.ts).
 *
 * RESOLVED (per direct request -- "50% what needs review, 50% strategy"):
 * the page is now genuinely half operational (BriefView, above) and half
 * strategic (StrategyCard, src/lib/strategy.ts) -- the latter IS real
 * Agent Core reasoning (SPEC.md phase 1), a budget-governed OpenAI call
 * over live cross-module state, not a template. See strategy.ts's header
 * for the full design (why it's cached/interval-refreshed rather than
 * called on every page load).
 */
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { NavPills } from "@/components/layout/nav-pills";
import { BriefView } from "@/components/brief-view";
import { StrategyCard } from "@/components/strategy-card";
import { composeBrief } from "@/lib/brief";
import { listMeetingsToday } from "@/lib/meetings";
import { getStrategyBrief } from "@/lib/strategy";
import {
  getComplianceAlerts,
  getDashboardStats,
  getLeadNamesByIds,
  getPipelineSummary,
  getPlanned,
  getReviewQueue,
  getTeamGoalsSummary,
} from "@/lib/queries";
import {
  FOUNDER_ONLY_NOTES,
  ROLE_LABELS,
  isDashboardRole,
  navItemsForRole,
  type DashboardRole,
} from "@/lib/roles";

// This page reads live rows straight from Postgres on every request (see
// src/lib/db.ts) -- never cache a stale "Today" briefing.
export const revalidate = 0;

interface TodayPageProps {
  searchParams: Promise<{ role?: string }>;
}

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const params = await searchParams;
  const role: DashboardRole = isDashboardRole(params.role) ? params.role : "owner_coo";

  const [stats, reviewQueue, teamGoals, pipelineSummary, complianceAlerts, planned, todayMeetings, strategy] = await Promise.all([
    getDashboardStats(),
    getReviewQueue(),
    getTeamGoalsSummary(),
    getPipelineSummary(),
    getComplianceAlerts(),
    getPlanned(),
    listMeetingsToday(),
    getStrategyBrief(),
  ]);

  const reviewQueueLeadIds = reviewQueue
    .map((item) => (item.kind === "proposal" || item.kind === "suggestion" ? item.data.lead_id : null))
    .filter((id): id is string => id !== null);
  const leadNamesById = await getLeadNamesByIds(reviewQueueLeadIds);

  const nav = navItemsForRole(role);
  const founderNote = FOUNDER_ONLY_NOTES[role];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const brief = composeBrief(
    {
      contactedThisWeek: stats.contactedThisWeek,
      conversionsThisMonth: stats.conversionsThisMonth,
      coldLeadsCount: stats.coldLeadsCount,
      todayFollowUpsCount: stats.todayFollowUps.length,
      reviewQueue,
      complianceAlerts,
      pipelineSummary,
      teamGoals,
      todayMeetings,
      greetingName: ROLE_LABELS[role],
    },
    leadNamesById
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {greeting} · {todayLabel}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stats.totalLeads} active leads · {stats.contactedThisWeek} contacted this week ·{" "}
                {stats.conversionsThisMonth} won this month · {stats.coldLeadsCount} cold
              </p>
            </div>
            <RoleSwitcher current={role} />
          </div>

          <NavPills nav={nav} active="today" />

          {founderNote && (
            <p className="text-xs italic text-muted-foreground">{founderNote}</p>
          )}
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <BriefView brief={brief} planned={planned} />
          <StrategyCard brief={strategy.brief} stale={strategy.stale} error={strategy.error} />
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground/60">
          Review queue &amp; planned items: composed from real data by rule-based logic, not AI. Strategy card: a real,
          budget-governed AI reasoning pass over the same live data (SPEC.md&apos;s Agent Core, phase 1).
        </p>
      </div>
    </div>
  );
}
