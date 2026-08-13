/**
 * Progress view ("/") — my goals + team goals, % to goal, streak/cadence.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Target } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { GoalProgressCard } from "@/components/goals/goal-progress-card";
import { IndividualGoalsList } from "@/components/goals/individual-goals-list";
import { getCurrentAgent } from "@/lib/current-agent";
import { db } from "@/lib/db";
import { getGoalProgressBatch, listAgents, listVisibleGoals } from "@/lib/goals";

export const revalidate = 0;

export default async function HomePage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");

  const pool = await db();
  const { individual, team } = await listVisibleGoals(pool, agent);
  const isManagerLike = agent.role === "owner_coo";

  const [individualProgress, teamProgress] = await Promise.all([
    getGoalProgressBatch(pool, individual),
    getGoalProgressBatch(pool, team),
  ]);

  let ownerNames: Record<string, string> = {};
  if (isManagerLike) {
    const agents = await listAgents(pool);
    ownerNames = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  }

  return (
    <AppShell agent={agent}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Progress</h1>
          <p className="text-sm text-muted-foreground">Days &amp; goals tracking</p>
        </div>
        <Link href="/goals/new">
          <Button size="sm">
            <Plus className="size-4" />
            New goal
          </Button>
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          {isManagerLike ? "Individual goals (all agents)" : "My goals"}
        </h2>
        {individualProgress.length > 0 ? (
          <IndividualGoalsList progress={individualProgress} ownerNames={ownerNames} rankByPerformance={isManagerLike} />
        ) : (
          <EmptyState />
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Team goals</h2>
        {teamProgress.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {teamProgress.map((p) => (
              <GoalProgressCard key={p.goal.id} progress={p} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
      <Target className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">No goals yet.</p>
      <Link href="/goals/new" className="text-sm text-primary hover:underline">
        Create one
      </Link>
    </div>
  );
}
