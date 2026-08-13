'use client';

import { useActionState } from 'react';
import type { Agent, GoalPeriodType, GoalScope } from '@mira/shared-types';
import { GOAL_PERIOD_TYPES, GOAL_SCOPES, RECOMMENDED_GOAL_METRICS } from '@mira/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createGoalAction, type ActionState } from '../actions';
import { isManagerLike as checkIsManagerLike } from '@/lib/goals';
import { todayIso } from '@/lib/utils';

const initialState: ActionState = {};

export function GoalForm({ currentAgent, agents }: { currentAgent: Agent; agents: Agent[] }) {
  const [state, formAction, pending] = useActionState(createGoalAction, initialState);
  const isManagerLike = checkIsManagerLike(currentAgent);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="scope">Scope</Label>
          <Select id="scope" name="scope" defaultValue="individual">
            {GOAL_SCOPES.map((s: GoalScope) => (
              <option key={s} value={s}>
                {s === 'individual' ? 'Individual' : 'Team'}
              </option>
            ))}
          </Select>
        </div>

        {isManagerLike && (
          <div className="space-y-1.5">
            <Label htmlFor="agent_id">Assign to (individual goals only)</Label>
            <Select id="agent_id" name="agent_id" defaultValue={currentAgent.id}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="metric">Metric</Label>
          <Input id="metric" name="metric" list="metric-options" placeholder="revenue_aed" required />
          <datalist id="metric-options">
            {RECOMMENDED_GOAL_METRICS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Unit (display only)</Label>
          <Input id="unit" name="unit" placeholder="AED, calls, viewings…" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="target_value">Target</Label>
          <Input id="target_value" name="target_value" type="number" step="any" min="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="period_type">Cadence</Label>
          <Select id="period_type" name="period_type" defaultValue="monthly">
            {GOAL_PERIOD_TYPES.map((p: GoalPeriodType) => (
              <option key={p} value={p} className="capitalize">
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="period_start">Period start</Label>
          <Input id="period_start" name="period_start" type="date" defaultValue={todayIso()} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="period_end">Period end</Label>
          <Input id="period_end" name="period_end" type="date" required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" placeholder="Optional context…" />
      </div>

      {state.error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create goal'}
      </Button>
    </form>
  );
}
