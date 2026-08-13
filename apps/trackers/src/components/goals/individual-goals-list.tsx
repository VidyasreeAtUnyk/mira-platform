"use client";

import { useState } from "react";
import type { GoalProgress } from "@mira/shared-types";
import { GoalProgressCard } from "./goal-progress-card";

const DEFAULT_VISIBLE = 4;
const RANK_MEDAL = ["🥇", "🥈", "🥉"];

interface IndividualGoalsListProps {
  progress: GoalProgress[];
  ownerNames: Record<string, string>;
  rankByPerformance: boolean;
}

/**
 * Individual-goals grid, client-side so "Show all" can expand without a
 * round trip. Only ranks/sorts by percentToGoal when `rankByPerformance` is
 * true (managers/owners, viewing everyone's goals -- a leaderboard feel is
 * the point there); a single agent's own goal list stays in the server's
 * original order, ranking your own goals against each other isn't
 * "top performers".
 */
export function IndividualGoalsList({ progress, ownerNames, rankByPerformance }: IndividualGoalsListProps) {
  const [expanded, setExpanded] = useState(false);

  const ordered = rankByPerformance
    ? [...progress].sort((a, b) => b.percentToGoal - a.percentToGoal)
    : progress;
  const visible = expanded ? ordered : ordered.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = ordered.length - visible.length;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((p, i) => (
          <div key={p.goal.id} className="relative">
            {rankByPerformance && i < 3 && (
              <span className="absolute -left-2 -top-2 z-10 text-lg leading-none" title={`#${i + 1} by progress`}>
                {RANK_MEDAL[i]}
              </span>
            )}
            <GoalProgressCard progress={p} ownerName={p.goal.agent_id ? ownerNames[p.goal.agent_id] : undefined} />
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 text-sm text-primary hover:underline"
        >
          Show all {ordered.length}
        </button>
      )}
      {expanded && ordered.length > DEFAULT_VISIBLE && (
        <button onClick={() => setExpanded(false)} className="mt-3 text-sm text-muted-foreground hover:underline">
          Show fewer
        </button>
      )}
    </div>
  );
}
