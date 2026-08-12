/**
 * Budget governor scaffold for this module, per SPEC.md's "all AI calls...
 * run against an explicit cap, enforced centrally" and CLAUDE.md's "no
 * unbounded loops of calls" rule.
 *
 * Nothing in this module currently calls a paid AI/model API — caption
 * generation (src/lib/ai/caption.ts) is template-based, and there is no
 * ANTHROPIC_API_KEY / OPENAI_API_KEY configured for this app (see
 * PROGRESS-social.md Blockers) — so this governor has no live traffic to
 * enforce against yet. It exists now, wired to the real `ai_call_log` table
 * (db/schema.sql), so that whenever AI-assisted captioning (or anything
 * else) is added later, it MUST go through `checkAndRecordCall()` rather
 * than calling a model API directly. Do not bypass this file when wiring a
 * real AI call in a future session.
 */
import { hasSupabaseCredentials, createServiceClient } from '@/lib/supabase/service';

export class BudgetExceededError extends Error {}

function getDailyCap(): number {
  const raw = process.env.SOCIAL_AI_DAILY_CALL_CAP;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20; // conservative default
}

/**
 * Call BEFORE making any AI/model API call from this module. Throws
 * BudgetExceededError if today's cap is already reached. Records the call
 * in `ai_call_log` (audited, not an in-memory counter that resets and
 * silently allows more spend than intended).
 */
export async function checkAndRecordCall(purpose: string, postId?: string): Promise<void> {
  const cap = getDailyCap();

  if (!hasSupabaseCredentials()) {
    // No DB in this environment -- fail closed rather than allow unmetered
    // calls. There should be no callers of this in the current build (see
    // module header), so hitting this path at all indicates new code needs
    // review before shipping.
    throw new BudgetExceededError(
      'AI budget governor requires a configured database to enforce the cap; refusing call.'
    );
  }

  const supabase = createServiceClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count, error: countErr } = await supabase
    .from('ai_call_log')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since.toISOString());
  if (countErr) throw new Error(`Budget governor count check failed: ${countErr.message}`);

  if ((count ?? 0) >= cap) {
    throw new BudgetExceededError(`Daily AI call cap (${cap}) reached for this module.`);
  }

  const { error: insertErr } = await supabase
    .from('ai_call_log')
    .insert({ purpose, post_id: postId ?? null });
  if (insertErr) throw new Error(`Budget governor failed to record call: ${insertErr.message}`);
}
