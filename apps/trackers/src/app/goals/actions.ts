'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { GOAL_PERIOD_TYPES, GOAL_SCOPES, GOAL_STATUSES } from '@mira/shared-types';
import { db } from '@/lib/db';
import { requireCurrentAgent } from '@/lib/current-agent';
import { addProgressEntry, createGoal, updateGoal, ForbiddenError } from '@/lib/goals';

export interface ActionState {
  error?: string;
}

const createGoalSchema = z
  .object({
    scope: z.enum(GOAL_SCOPES),
    agent_id: z.string().uuid().optional().or(z.literal('')),
    metric: z.string().trim().min(1, 'Metric is required'),
    unit: z.string().trim().optional().or(z.literal('')),
    target_value: z.coerce.number().positive('Target must be greater than 0'),
    period_type: z.enum(GOAL_PERIOD_TYPES),
    period_start: z.string().min(1, 'Start date is required'),
    period_end: z.string().min(1, 'End date is required'),
    notes: z.string().trim().optional().or(z.literal('')),
  })
  .refine((v) => v.period_end >= v.period_start, {
    message: 'End date must be on or after the start date',
    path: ['period_end'],
  });

export async function createGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createGoalSchema.safeParse({
    scope: formData.get('scope'),
    agent_id: formData.get('agent_id') ?? '',
    metric: formData.get('metric'),
    unit: formData.get('unit') ?? '',
    target_value: formData.get('target_value'),
    period_type: formData.get('period_type'),
    period_start: formData.get('period_start'),
    period_end: formData.get('period_end'),
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const agent = await requireCurrentAgent();
  const pool = await db();

  let goal;
  try {
    goal = await createGoal(
      pool,
      {
        scope: parsed.data.scope,
        agent_id: parsed.data.agent_id || undefined,
        metric: parsed.data.metric,
        unit: parsed.data.unit || undefined,
        target_value: parsed.data.target_value,
        period_type: parsed.data.period_type,
        period_start: parsed.data.period_start,
        period_end: parsed.data.period_end,
        notes: parsed.data.notes || undefined,
      },
      agent
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }

  revalidatePath('/');
  redirect(`/goals/${goal.id}`);
}

const updateGoalSchema = z.object({
  goal_id: z.string().uuid(),
  target_value: z.coerce.number().positive('Target must be greater than 0'),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  status: z.enum(GOAL_STATUSES),
  notes: z.string().trim().optional().or(z.literal('')),
});

export async function updateGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateGoalSchema.safeParse({
    goal_id: formData.get('goal_id'),
    target_value: formData.get('target_value'),
    period_start: formData.get('period_start'),
    period_end: formData.get('period_end'),
    status: formData.get('status'),
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  if (parsed.data.period_end < parsed.data.period_start) {
    return { error: 'End date must be on or after the start date' };
  }

  const agent = await requireCurrentAgent();
  const pool = await db();

  try {
    await updateGoal(
      pool,
      parsed.data.goal_id,
      {
        target_value: parsed.data.target_value,
        period_start: parsed.data.period_start,
        period_end: parsed.data.period_end,
        status: parsed.data.status,
        notes: parsed.data.notes || undefined,
      },
      agent
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }

  revalidatePath('/');
  revalidatePath(`/goals/${parsed.data.goal_id}`);
  return {};
}

const logProgressSchema = z.object({
  goal_id: z.string().uuid(),
  entry_date: z.string().min(1, 'Date is required'),
  value: z.coerce.number(),
  note: z.string().trim().optional().or(z.literal('')),
});

export async function logProgressAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = logProgressSchema.safeParse({
    goal_id: formData.get('goal_id'),
    entry_date: formData.get('entry_date'),
    value: formData.get('value'),
    note: formData.get('note') ?? '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const agent = await requireCurrentAgent();
  const pool = await db();

  try {
    await addProgressEntry(
      pool,
      {
        goal_id: parsed.data.goal_id,
        entry_date: parsed.data.entry_date,
        value: parsed.data.value,
        note: parsed.data.note || undefined,
      },
      agent
    );
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }

  revalidatePath('/');
  revalidatePath(`/goals/${parsed.data.goal_id}`);
  return {};
}
