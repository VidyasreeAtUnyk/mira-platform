import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAgent } from "@/lib/current-agent";
import { db } from "@/lib/db";
import { isManagerLike, listAgents } from "@/lib/goals";
import { GoalForm } from "./goal-form";

export const revalidate = 0;

export default async function NewGoalPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");

  const canManage = isManagerLike(agent);
  const pool = await db();
  const agents = canManage ? await listAgents(pool) : [];

  return (
    <AppShell agent={agent}>
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold mb-6">New goal</h1>
        <Card>
          <CardHeader>
            <CardTitle>Goal details</CardTitle>
          </CardHeader>
          <CardContent>
            <GoalForm currentAgent={agent} agents={agents} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
