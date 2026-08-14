import { Compass, GraduationCap, Users, TrendingUp, Sparkles } from "lucide-react";
import type { StrategyBrief } from "@/lib/strategy";

const FOCUS_ICON: Record<StrategyBrief["focusType"], typeof Compass> = {
  lead: Users,
  networking: Users,
  market: TrendingUp,
  action: Compass,
};

const FOCUS_LABEL: Record<StrategyBrief["focusType"], string> = {
  lead: "Lead to act on",
  networking: "Networking move",
  market: "Market opportunity",
  action: "Today's focus",
};

/**
 * The "strategy" half of the Today view -- SPEC.md's Agent Core (see
 * src/lib/strategy.ts's header): a real, AI-reasoned answer to "what's
 * the single highest-leverage thing to do today", sourced and specific,
 * not a generic "network more" placeholder. Sits next to BriefView's
 * operational half so the page is genuinely half review-queue, half
 * strategy, per direct request.
 */
export function StrategyCard({
  brief,
  stale,
  error,
}: {
  brief: StrategyBrief | null;
  stale: boolean;
  error: string | null;
}) {
  if (!brief) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          Strategy brief unavailable
        </div>
        <p className="text-xs text-muted-foreground">
          {error ?? "Couldn't generate a strategy brief right now."} Refreshes automatically once available.
        </p>
      </div>
    );
  }

  const Icon = FOCUS_ICON[brief.focusType];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Strategy
        </div>
        {stale && <span className="text-[10px] text-muted-foreground/70">Showing last generated brief -- refresh pending</span>}
      </div>

      <p className="mb-3 text-sm font-medium text-foreground">{brief.headline}</p>

      <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          <Icon className="h-3.5 w-3.5" />
          {FOCUS_LABEL[brief.focusType]}
        </div>
        <p className="mb-1.5 text-sm font-medium text-foreground">{brief.focusTitle}</p>
        <p className="mb-2 text-xs leading-relaxed text-foreground/80">{brief.focusDetail}</p>
        <div className="space-y-0.5 text-[11px] text-muted-foreground">
          <p>
            <span className="font-medium">Source:</span> {brief.focusSource}
          </p>
          <p>
            <span className="font-medium">Why it matters:</span> {brief.focusBenefit}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
        <p>{brief.educationalNugget}</p>
      </div>
    </div>
  );
}
