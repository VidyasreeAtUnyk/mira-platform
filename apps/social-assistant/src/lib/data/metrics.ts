/**
 * Performance monitoring — structure/hooks only. There is no live posting
 * integration in this module, so there is no live channel to pull real
 * metrics from. This file intentionally never fabricates numbers: it either
 * reads genuine rows (which, today, don't exist because nothing has ever
 * posted) or returns an empty result with a clear "not connected" reason.
 *
 * When a real posting integration lands (out of scope for this session, see
 * PROGRESS-social.md Next), a scheduled job would call `recordMetric()` with
 * source: 'platform_api' after pulling real numbers from that platform's
 * API. `recordMetric()` deliberately has no caller anywhere in this module
 * yet.
 */
import type { SocialPostMetric, MetricType, Platform } from '@/types/social';
import { hasSupabaseCredentials, createServiceClient } from '@/lib/supabase/service';

export interface MetricsResult {
  connected: boolean;
  metrics: SocialPostMetric[];
  reason?: string;
}

export async function getMetricsForPost(postId: string): Promise<MetricsResult> {
  if (!hasSupabaseCredentials()) {
    return {
      connected: false,
      metrics: [],
      reason: 'No database configured in this environment, and no live posting integration exists yet.',
    };
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('social_post_metrics')
    .select('*')
    .eq('post_id', postId)
    .order('recorded_at', { ascending: false });
  if (error) throw new Error(`Failed to load metrics: ${error.message}`);
  return {
    connected: true,
    metrics: (data ?? []) as SocialPostMetric[],
    reason:
      (data ?? []).length === 0
        ? 'No metrics recorded yet — no live posting integration exists to report real performance.'
        : undefined,
  };
}

/**
 * Not called anywhere in this build. Exists so the future posting/metrics
 * ingestion job has a single, audited write path instead of ad hoc inserts.
 * `source: 'platform_api'` is required — this function is not a way to
 * inject fake numbers for a demo.
 */
export async function recordMetric(input: {
  post_id: string;
  platform: Platform;
  metric_type: MetricType;
  value: number;
  source: 'platform_api';
}): Promise<void> {
  if (!hasSupabaseCredentials()) {
    throw new Error('Cannot record metrics without a configured database.');
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from('social_post_metrics').insert({
    ...input,
    recorded_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to record metric: ${error.message}`);
}
