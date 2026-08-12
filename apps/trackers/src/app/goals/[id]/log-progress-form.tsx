'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logProgressAction, type ActionState } from '../actions';
import { todayIso } from '@/lib/utils';

const initialState: ActionState = {};

export function LogProgressForm({ goalId, unit }: { goalId: string; unit: string | null }) {
  const [state, formAction, pending] = useActionState(logProgressAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="goal_id" value={goalId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="entry_date">Date</Label>
          <Input id="entry_date" name="entry_date" type="date" defaultValue={todayIso()} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="value">Value {unit ? `(${unit})` : ''}</Label>
          <Input id="value" name="value" type="number" step="any" required autoFocus />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" placeholder="Optional" />
      </div>

      {state.error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Logging…' : 'Log progress'}
      </Button>
    </form>
  );
}
