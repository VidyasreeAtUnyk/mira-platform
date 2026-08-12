'use client';

import { useActionState } from 'react';
import type { Goal } from '@mira/shared-types';
import { GOAL_STATUSES } from '@mira/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { updateGoalAction, type ActionState } from '../actions';

const initialState: ActionState = {};

export function EditGoalForm({ goal, canEdit }: { goal: Goal; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(updateGoalAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="goal_id" value={goal.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="target_value">Target</Label>
          <Input
            id="target_value"
            name="target_value"
            type="number"
            step="any"
            min="0.01"
            defaultValue={goal.target_value}
            disabled={!canEdit}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={goal.status} disabled={!canEdit}>
            {GOAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="period_start">Period start</Label>
          <Input id="period_start" name="period_start" type="date" defaultValue={goal.period_start} disabled={!canEdit} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="period_end">Period end</Label>
          <Input id="period_end" name="period_end" type="date" defaultValue={goal.period_end} disabled={!canEdit} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={goal.notes ?? ''} disabled={!canEdit} />
      </div>

      {state.error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{state.error}</p>}

      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      )}
    </form>
  );
}
