/**
 * Goal / progress-entry data access + the `GoalProgress` aggregation query.
 *
 * Authorization here is application-code enforcement of the same rules
 * mirrored in apps/trackers/supabase/migrations/001_goals.sql's RLS
 * policies -- necessary because the direct-`pg` path this app's server
 * components/actions use does NOT go through PostgREST, so Postgres RLS is
 * not actually applied to these queries (see src/lib/db.ts's header for the
 * full reasoning). Keep these two files in sync by hand; that's a real
 * maintenance risk flagged for human review, not an oversight.
 *
 * Visibility/edit mapping (best-effort placeholder per
 * PROGRESS-trackers.md -- AgentRole is coarser than SPEC.md's full 6-row
 * RBAC table, a human should confirm this once the fuller role set exists):
 *   - manager / admin: view + edit every goal (individual and team).
 *   - agent: view their own individual goals plus every team goal; may only
 *     create/edit their OWN individual goals. Team goals are
 *     manager/admin-owned for editing purposes (agent_id is null, there's no
 *     "own" team goal), but any agent may log a progress entry against a
 *     team goal they can see -- team goals are collective by design.
 */

import type {
  Agent,
  CreateGoalInput,
  CreateGoalProgressEntryInput,
  Goal,
  GoalProgress,
  GoalProgressEntry,
  UpdateGoalInput,
} from "@mira/shared-types";
import type { Pool } from "pg";

export class ForbiddenError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * "Manager-like" under the old 3-value role model meant 'manager' or
 * 'admin' -- both of which had unrestricted see/edit-everything access.
 * Under SPEC.md's 6-role model (see PROGRESS-integration.md) that access
 * level maps to exactly one role, owner_coo, not the narrower senior_agent.
 */
export function isManagerLike(agent: Agent): boolean {
  return agent.role === "owner_coo";
}

export function canViewGoal(agent: Agent, goal: Goal): boolean {
  if (isManagerLike(agent)) return true;
  if (goal.scope === "team") return true;
  return goal.agent_id === agent.id;
}

export function canEditGoal(agent: Agent, goal: Goal): boolean {
  if (isManagerLike(agent)) return true;
  return goal.scope === "individual" && goal.agent_id === agent.id;
}

export function canLogProgress(agent: Agent, goal: Goal): boolean {
  // Anyone who can see the goal can log against it -- team goals are
  // collective, individual goals are only visible to their owner + managers.
  return canViewGoal(agent, goal);
}

/** Goals the current agent is allowed to see, split by scope for the progress view. */
export async function listVisibleGoals(pool: Pool, agent: Agent): Promise<{ individual: Goal[]; team: Goal[] }> {
  if (isManagerLike(agent)) {
    const result = await pool.query<Goal>(
      `select * from goals order by scope, status = 'archived', period_start desc`
    );
    return {
      individual: result.rows.filter((g) => g.scope === "individual"),
      team: result.rows.filter((g) => g.scope === "team"),
    };
  }

  const individual = await pool.query<Goal>(
    `select * from goals where scope = 'individual' and agent_id = $1 order by status = 'archived', period_start desc`,
    [agent.id]
  );
  const team = await pool.query<Goal>(
    `select * from goals where scope = 'team' order by status = 'archived', period_start desc`
  );
  return { individual: individual.rows, team: team.rows };
}

export async function getGoal(pool: Pool, id: string, agent: Agent): Promise<Goal | null> {
  const result = await pool.query<Goal>(`select * from goals where id = $1`, [id]);
  const goal = result.rows[0];
  if (!goal) return null;
  if (!canViewGoal(agent, goal)) throw new ForbiddenError("You cannot view this goal");
  return goal;
}

export async function createGoal(pool: Pool, input: CreateGoalInput, agent: Agent): Promise<Goal> {
  if (input.scope === "team") {
    if (!isManagerLike(agent)) throw new ForbiddenError("Only managers/admins can create team goals");
    if (input.agent_id) throw new ForbiddenError("Team goals must not have an agent_id");
  } else {
    const targetAgentId = input.agent_id ?? agent.id;
    if (targetAgentId !== agent.id && !isManagerLike(agent)) {
      throw new ForbiddenError("You can only create individual goals for yourself");
    }
    input = { ...input, agent_id: targetAgentId };
  }

  const result = await pool.query<Goal>(
    `insert into goals (scope, agent_id, created_by, metric, unit, target_value, period_type, period_start, period_end, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
    [
      input.scope,
      input.scope === "team" ? null : input.agent_id,
      agent.id,
      input.metric,
      input.unit ?? null,
      input.target_value,
      input.period_type,
      input.period_start,
      input.period_end,
      input.notes ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateGoal(pool: Pool, id: string, input: UpdateGoalInput, agent: Agent): Promise<Goal> {
  const existing = await getGoal(pool, id, agent);
  if (!existing) throw new Error("Goal not found");
  if (!canEditGoal(agent, existing)) throw new ForbiddenError("You cannot edit this goal");

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  function set(column: string, value: unknown) {
    fields.push(`${column} = $${i}`);
    values.push(value);
    i++;
  }

  if (input.target_value !== undefined) set("target_value", input.target_value);
  if (input.period_start !== undefined) set("period_start", input.period_start);
  if (input.period_end !== undefined) set("period_end", input.period_end);
  if (input.status !== undefined) set("status", input.status);
  if (input.notes !== undefined) set("notes", input.notes);

  if (fields.length === 0) return existing;

  values.push(id);
  const result = await pool.query<Goal>(
    `update goals set ${fields.join(", ")} where id = $${i} returning *`,
    values
  );
  return result.rows[0];
}

export async function listProgressEntries(pool: Pool, goalId: string, agent: Agent): Promise<GoalProgressEntry[]> {
  const goal = await getGoal(pool, goalId, agent);
  if (!goal) throw new Error("Goal not found");
  const result = await pool.query<GoalProgressEntry>(
    `select * from goal_progress_entries where goal_id = $1 order by entry_date desc, created_at desc`,
    [goalId]
  );
  return result.rows;
}

export async function addProgressEntry(
  pool: Pool,
  input: CreateGoalProgressEntryInput,
  agent: Agent
): Promise<GoalProgressEntry> {
  const goal = await getGoal(pool, input.goal_id, agent);
  if (!goal) throw new Error("Goal not found");
  if (!canLogProgress(agent, goal)) throw new ForbiddenError("You cannot log progress against this goal");

  const result = await pool.query<GoalProgressEntry>(
    `insert into goal_progress_entries (goal_id, entry_date, value, note, logged_by)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [input.goal_id, input.entry_date, input.value, input.note ?? null, agent.id]
  );
  return result.rows[0];
}

/**
 * `currentStreakDays` per packages/shared-types's doc comment: "Consecutive
 * most-recent days (including today) with at least one progress entry."
 * Read literally: today itself must have an entry for the streak to be
 * nonzero (no grace period for "haven't logged yet today"). Flagging this
 * reading explicitly since the alternative (streak survives until end of
 * day even without today's entry) is also a defensible product choice a
 * human might prefer -- easy to change here if so, this is the only place
 * the rule is implemented.
 */
function computeStreakDays(entryDatesDesc: string[]): number {
  if (entryDatesDesc.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  if (entryDatesDesc[0] !== today) return 0;

  let streak = 1;
  for (let i = 1; i < entryDatesDesc.length; i++) {
    const prev = new Date(`${entryDatesDesc[i - 1]}T00:00:00Z`).getTime();
    const cur = new Date(`${entryDatesDesc[i]}T00:00:00Z`).getTime();
    const diffDays = Math.round((prev - cur) / 86_400_000);
    if (diffDays === 1) {
      streak++;
    } else if (diffDays === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export async function getGoalProgress(pool: Pool, goal: Goal): Promise<GoalProgress> {
  const totals = await pool.query<{ total: number | null; entry_count: string; last_entry_date: string | null }>(
    `select sum(value)::float8 as total, count(*) as entry_count, max(entry_date) as last_entry_date
     from goal_progress_entries where goal_id = $1`,
    [goal.id]
  );
  const distinctDates = await pool.query<{ entry_date: string }>(
    `select distinct entry_date from goal_progress_entries where goal_id = $1 order by entry_date desc`,
    [goal.id]
  );

  const totalLogged = totals.rows[0]?.total ?? 0;
  const entryCount = Number(totals.rows[0]?.entry_count ?? 0);
  const lastEntryDate = totals.rows[0]?.last_entry_date ?? null;
  const percentToGoal = goal.target_value > 0 ? (totalLogged / goal.target_value) * 100 : 0;
  const currentStreakDays = computeStreakDays(distinctDates.rows.map((r) => r.entry_date));

  return {
    goal,
    totalLogged,
    percentToGoal,
    currentStreakDays,
    entryCount,
    lastEntryDate,
  };
}

export async function getGoalProgressBatch(pool: Pool, goals: Goal[]): Promise<GoalProgress[]> {
  return Promise.all(goals.map((g) => getGoalProgress(pool, g)));
}

/** All agents, for the "assign to" select on the create-goal form (managers/admins only). */
export async function listAgents(pool: Pool): Promise<Agent[]> {
  const result = await pool.query<Agent>(`select * from agents order by name`);
  return result.rows;
}
