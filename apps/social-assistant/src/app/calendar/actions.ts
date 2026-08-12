'use server';

import { revalidatePath } from 'next/cache';
import { updatePostStatus, InvalidPostStateError } from '@/lib/data/posts';
import type { PostStatus } from '@/types/social';

export interface TransitionResult {
  ok: boolean;
  error?: string;
}

/**
 * Draft-and-hold transitions only (see src/lib/data/posts.ts's
 * ALLOWED_TRANSITIONS) -- there is no "posted"/"published" status to
 * transition into anywhere in this module.
 */
export async function transitionPostStatus(id: string, status: PostStatus): Promise<TransitionResult> {
  try {
    await updatePostStatus(id, status);
    revalidatePath('/calendar');
    return { ok: true };
  } catch (err) {
    if (err instanceof InvalidPostStateError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update status.' };
  }
}
