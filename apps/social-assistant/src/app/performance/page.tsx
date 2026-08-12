import { listPosts } from '@/lib/data/posts';
import { getMetricsForPost } from '@/lib/data/metrics';
import { StatusBadge, Badge } from '@/components/ui/badge';

export const revalidate = 0;

/**
 * Structure-only placeholder, per this session's scope (see
 * PROGRESS-social.md): there is no live posting integration anywhere in
 * this module, so there is no real channel to pull impressions/reach/
 * likes/etc from. This page never fabricates numbers -- it shows the
 * shape performance monitoring will have (per post, per metric type) and
 * an honest "not connected" state for every post, sourced from
 * src/lib/data/metrics.ts's `getMetricsForPost()`.
 */
export default async function PerformancePage() {
  const posts = await listPosts();
  const withMetrics = await Promise.all(posts.map(async (post) => ({ post, result: await getMetricsForPost(post.id) })));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-wide text-brand-body">Performance monitoring</h1>
      <p className="mb-6 max-w-2xl text-sm text-brand-body/60">
        Structure only — there is no live posting integration in this module, so there is no channel to pull real
        impressions/reach/engagement from yet. Nothing below is a placeholder number; every row honestly reports
        &quot;not connected&quot; until a real platform API is wired up and starts writing rows with{' '}
        <code className="text-brand-gold-light">source: &apos;platform_api&apos;</code>.
      </p>

      <div className="space-y-3">
        {withMetrics.length === 0 && <p className="text-sm text-brand-body/40">No posts yet.</p>}
        {withMetrics.map(({ post, result }) => (
          <div key={post.id} className="rounded-lg border border-brand-hairline bg-brand-bg-alt p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={post.status} />
              <Badge>{post.kind.replace('_', ' ')}</Badge>
              <Badge>{post.platform.replace('_', ' ')}</Badge>
            </div>
            <p className="mb-2 text-sm text-brand-body/80">
              {post.caption || <em className="text-brand-body/40">No caption</em>}
            </p>
            {result.connected ? (
              result.metrics.length > 0 ? (
                <div className="flex flex-wrap gap-3 text-xs text-brand-body/70">
                  {result.metrics.map((m) => (
                    <span key={m.id}>
                      {m.metric_type}: {m.value} ({m.source})
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-body/40">{result.reason}</p>
              )
            ) : (
              <p className="text-xs text-brand-body/40">Not connected — {result.reason}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
