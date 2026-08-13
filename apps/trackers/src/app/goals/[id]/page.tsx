import { notFound, redirect } from "next/navigation";
import { Flame } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/goals/progress-bar";
import { getCurrentAgent } from "@/lib/current-agent";
import { db } from "@/lib/db";
import { canEditGoal, canLogProgress, getGoal, getGoalProgress, listProgressEntries, ForbiddenError, listAgents } from "@/lib/goals";
import { computeForecast } from "@/lib/forecast";
import { formatDate, formatMetricLabel, formatNumber } from "@/lib/utils";
import { EditGoalForm } from "./edit-goal-form";
import { LogProgressForm } from "./log-progress-form";
import { EntryHistory } from "./entry-history";
import { ForecastChart } from "@/components/goals/forecast-chart";

export const revalidate = 0;

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");

  const pool = await db();

  let goal;
  try {
    goal = await getGoal(pool, id, agent);
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return (
        <AppShell agent={agent}>
          <p className="text-sm text-destructive">{e.message}</p>
        </AppShell>
      );
    }
    throw e;
  }
  if (!goal) notFound();

  const [progress, entries] = await Promise.all([
    getGoalProgress(pool, goal),
    listProgressEntries(pool, goal.id, agent),
  ]);

  let ownerName: string | null = null;
  if (goal.scope === "individual" && goal.agent_id) {
    if (goal.agent_id === agent.id) {
      ownerName = agent.name;
    } else {
      const agents = await listAgents(pool);
      ownerName = agents.find((a) => a.id === goal.agent_id)?.name ?? null;
    }
  }

  const editable = canEditGoal(agent, goal);
  const loggable = canLogProgress(agent, goal);
  const forecast = computeForecast(goal, entries, progress.totalLogged);

  return (
    <AppShell agent={agent}>
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold">{formatMetricLabel(goal.metric)}</h1>
          <Badge variant={goal.scope === "team" ? "secondary" : "default"} className="capitalize">
            {goal.scope}
          </Badge>
          {goal.status !== "active" && (
            <Badge variant="secondary" className="capitalize">
              {goal.status}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {formatDate(goal.period_start)} – {formatDate(goal.period_end)}
          {ownerName ? ` · ${ownerName}` : ""}
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold">
              {formatNumber(progress.totalLogged)} {goal.unit ?? ""}
              <span className="text-muted-foreground text-sm font-normal">
                {" "}
                / {formatNumber(goal.target_value)} {goal.unit ?? ""}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">{Math.round(progress.percentToGoal)}%</span>
          </div>
          <ProgressBar percent={progress.percentToGoal} />
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span>{progress.entryCount} entries</span>
            <span>{progress.lastEntryDate ? `Last logged ${formatDate(progress.lastEntryDate)}` : "No entries yet"}</span>
            {progress.currentStreakDays > 0 && (
              <span className="flex items-center gap-1 text-primary font-medium">
                <Flame className="size-3.5" />
                {progress.currentStreakDays}-day streak
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Forecast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className={`text-sm ${forecast.onTrack ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {forecast.note}
          </p>
          {forecast.series.some((p) => p.cumulative > 0) && (
            <div className="text-muted-foreground">
              <ForecastChart series={forecast.series} target={goal.target_value} projectedTotal={forecast.projectedTotal} />
            </div>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground pt-1">
            <span>Day {forecast.daysElapsed} of {forecast.daysTotal}</span>
            <span>Current pace: {formatNumber(forecast.pacePerDay)} {goal.unit ?? ""}/day</span>
            {!forecast.onTrack && forecast.daysRemaining > 0 && (
              <span>Need +{formatNumber(forecast.extraPerDayNeeded)} {goal.unit ?? ""}/day to hit target</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-6">
          {loggable && (
            <Card>
              <CardHeader>
                <CardTitle>Log progress</CardTitle>
              </CardHeader>
              <CardContent>
                <LogProgressForm goalId={goal.id} unit={goal.unit} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Entry history</CardTitle>
            </CardHeader>
            <CardContent>
              <EntryHistory entries={entries} unit={goal.unit} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editable ? "Edit goal" : "Goal details"}</CardTitle>
          </CardHeader>
          <CardContent>
            <EditGoalForm goal={goal} canEdit={editable} />
            {goal.notes && !editable && <p className="text-sm text-muted-foreground mt-3">{goal.notes}</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
