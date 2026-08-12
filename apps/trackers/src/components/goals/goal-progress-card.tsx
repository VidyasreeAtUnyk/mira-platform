import Link from "next/link";
import { Flame } from "lucide-react";
import type { GoalProgress } from "@mira/shared-types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "./progress-bar";
import { formatDate, formatMetricLabel, formatNumber } from "@/lib/utils";

const PERIOD_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  custom: "Custom",
};

export function GoalProgressCard({ progress, ownerName }: { progress: GoalProgress; ownerName?: string }) {
  const { goal, totalLogged, percentToGoal, currentStreakDays, lastEntryDate } = progress;

  return (
    <Link href={`/goals/${goal.id}`}>
      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{formatMetricLabel(goal.metric)}</span>
              {goal.status !== "active" && (
                <Badge variant="secondary" className="capitalize">
                  {goal.status}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {PERIOD_LABEL[goal.period_type] ?? goal.period_type} · {formatDate(goal.period_start)} –{" "}
              {formatDate(goal.period_end)}
              {ownerName ? ` · ${ownerName}` : ""}
            </p>
          </div>
          {currentStreakDays > 0 && (
            <span className="flex items-center gap-1 shrink-0 text-xs font-medium text-primary">
              <Flame className="size-3.5" />
              {currentStreakDays}d
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {formatNumber(totalLogged)} {goal.unit ?? ""}
              <span className="text-muted-foreground"> / {formatNumber(goal.target_value)} {goal.unit ?? ""}</span>
            </span>
            <span className="text-muted-foreground text-xs">{Math.round(percentToGoal)}%</span>
          </div>
          <ProgressBar percent={percentToGoal} />
          <p className="text-xs text-muted-foreground">
            {lastEntryDate ? `Last logged ${formatDate(lastEntryDate)}` : "No progress logged yet"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
