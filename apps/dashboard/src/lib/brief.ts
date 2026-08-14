/**
 * Deterministic, template-composed narrative for the Today view -- turns
 * the same structured data the old stat-tile layout rendered into a short
 * human-voiced brief instead (what happened / what's happening / what
 * needs attention), with mood driven by real thresholds, not decoration.
 * No AI call: same reasoning as apps/social-assistant's caption.ts and
 * apps/trackers's forecast.ts -- deterministic composition needs no
 * budget-governor gate, and a template can already do a decent first pass
 * at "brief me like a person would." A real Agent Core-written version is
 * future work (see PROGRESS-integration.md roadmap notes), not this.
 */
import type { NotificationTier } from "@mira/shared-types";
import type { ComplianceAlert, PipelineStageCount, ReviewQueueItem, TeamGoalProgress } from "./queries";

export interface AttentionItem {
  text: string;
  tier: NotificationTier;
  /** Absolute path into another zone (e.g. "/pipeline/transactions/xyz") -- real navigation via Multi-Zones, only set when a reachable detail page genuinely exists today. */
  href: string | null;
  /** Shown next to the item when href is null, so the gap is visible rather than silently missing a link. */
  noLinkReason?: string;
}

export interface Brief {
  mood: "strong" | "steady" | "busy" | "quiet";
  headline: string;
  summary: string;
  attention: AttentionItem[];
}

interface BriefInputs {
  contactedThisWeek: number;
  conversionsThisMonth: number;
  coldLeadsCount: number;
  todayFollowUpsCount: number;
  reviewQueue: ReviewQueueItem[];
  complianceAlerts: ComplianceAlert[];
  pipelineSummary: { activeCount: number; byStage: PipelineStageCount[] };
  teamGoals: TeamGoalProgress[];
  greetingName: string;
}

function reviewQueueItemLabel(item: ReviewQueueItem, leadNamesById: Map<string, string>): string {
  if (item.kind === "proposal") {
    const name = leadNamesById.get(item.data.lead_id);
    return name ? `${item.data.type.replace(/_/g, " ")} for ${name}` : item.data.type.replace(/_/g, " ");
  }
  if (item.kind === "suggestion") {
    const name = leadNamesById.get(item.data.lead_id);
    return name ? `${item.data.suggestion_type.replace(/_/g, " ")} for ${name}` : item.data.suggestion_type.replace(/_/g, " ");
  }
  if (item.kind === "social_post") {
    return `${item.data.kind.replace(/_/g, " ")} post — ${item.data.platform}`;
  }
  return `${item.data.channel} draft for ${item.data.contactName}`;
}

function reviewQueueItemLink(item: ReviewQueueItem): { href: string | null; noLinkReason?: string } {
  if (item.kind === "comms_draft") return { href: `/comms/thread/${item.data.threadId}` };
  if (item.kind === "social_post") return { href: `/social/calendar` };
  return { href: null, noLinkReason: "CRM isn't cross-linked here yet" };
}

export function composeBrief(inputs: BriefInputs, leadNamesById: Map<string, string>): Brief {
  const {
    contactedThisWeek,
    conversionsThisMonth,
    coldLeadsCount,
    todayFollowUpsCount,
    reviewQueue,
    complianceAlerts,
    pipelineSummary,
    teamGoals,
    greetingName,
  } = inputs;

  const urgentCount = reviewQueue.filter((i) => i.tier === "urgent").length + complianceAlerts.filter((a) => a.urgency === "overdue").length;
  const todayCount = reviewQueue.filter((i) => i.tier === "today").length;
  const totalNeedsAttention = urgentCount + todayCount + todayFollowUpsCount + coldLeadsCount;

  let mood: Brief["mood"];
  if (urgentCount > 0) mood = "busy";
  else if (totalNeedsAttention >= 6) mood = "busy";
  else if (conversionsThisMonth > 0 && totalNeedsAttention <= 3) mood = "strong";
  else if (totalNeedsAttention === 0) mood = "quiet";
  else mood = "steady";

  const headline: Record<Brief["mood"], string> = {
    strong: `Good momentum, ${greetingName}.`,
    steady: `Here's where things stand, ${greetingName}.`,
    busy: `A full plate today, ${greetingName}.`,
    quiet: `A calm one so far, ${greetingName}.`,
  };

  const happenedParts: string[] = [];
  if (contactedThisWeek > 0) happenedParts.push(`${contactedThisWeek} conversation${contactedThisWeek === 1 ? "" : "s"} this week`);
  if (conversionsThisMonth > 0) happenedParts.push(`${conversionsThisMonth} deal${conversionsThisMonth === 1 ? "" : "s"} closed this month`);
  const happened = happenedParts.length > 0 ? happenedParts.join(", ") : "not much logged yet this week";

  const nowParts: string[] = [];
  if (todayFollowUpsCount > 0) nowParts.push(`${todayFollowUpsCount} follow-up${todayFollowUpsCount === 1 ? "" : "s"} due today`);
  if (reviewQueue.length > 0) nowParts.push(`${reviewQueue.length} item${reviewQueue.length === 1 ? "" : "s"} waiting on your review`);
  if (coldLeadsCount > 0) nowParts.push(`${coldLeadsCount} lead${coldLeadsCount === 1 ? "" : "s"} gone quiet`);
  const now = nowParts.length > 0 ? nowParts.join(", ") : "the queue is clear";

  const pipelineNote =
    pipelineSummary.activeCount > 0
      ? ` ${pipelineSummary.activeCount} deal${pipelineSummary.activeCount === 1 ? " is" : "s are"} moving through the pipeline.`
      : "";

  const summary = `This week: ${happened}. Right now: ${now}.${pipelineNote}`;

  const attention: AttentionItem[] = [];

  for (const item of reviewQueue) {
    if (item.tier === "fyi") continue;
    const { href, noLinkReason } = reviewQueueItemLink(item);
    attention.push({ text: reviewQueueItemLabel(item, leadNamesById), tier: item.tier, href, noLinkReason });
  }

  for (const alert of complianceAlerts) {
    attention.push({
      text: `${alert.developerPartnerName} MOU ${alert.urgency === "overdue" ? "overdue" : "expiring soon"} — ${alert.termEnd}`,
      tier: alert.urgency === "overdue" ? "urgent" : "today",
      href: null,
      noLinkReason: "Inventory has no web UI yet (CLI/tests only)",
    });
  }

  const behindGoal = teamGoals.find((g) => g.percentToGoal < 50);
  if (behindGoal) {
    attention.push({
      text: `Team goal "${behindGoal.goal.metric.replace(/_/g, " ")}" at ${Math.round(behindGoal.percentToGoal)}%`,
      tier: "today",
      href: "/trackers",
    });
  }

  const tierRank: Record<NotificationTier, number> = { urgent: 0, today: 1, fyi: 2 };
  attention.sort((a, b) => tierRank[a.tier] - tierRank[b.tier]);

  return { mood, headline: headline[mood], summary, attention: attention.slice(0, 8) };
}
