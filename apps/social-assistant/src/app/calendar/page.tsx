import Link from 'next/link';
import { listPosts } from '@/lib/data/posts';
import { listListingsForPoster } from '@/lib/data/properties';
import { Button } from '@/components/ui/button';
import { PostCard } from './post-card';
import { POST_STATUSES } from '@/types/social';

export const revalidate = 0;

const COLUMN_TITLES: Record<(typeof POST_STATUSES)[number], string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  held: 'Held',
};

export default async function CalendarPage() {
  const [posts, listings] = await Promise.all([listPosts(), listListingsForPoster()]);
  const listingById = new Map(listings.map((l) => [l.id, l]));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-wide text-brand-body">Content calendar</h1>
          <p className="text-sm text-brand-body/60">
            {posts.length} post{posts.length === 1 ? '' : 's'} — draft-and-hold only, nothing here ever posts
            automatically.
          </p>
        </div>
        <Link href="/posters/new">
          <Button variant="primary">New poster</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {POST_STATUSES.map((status) => {
          const columnPosts = posts.filter((p) => p.status === status);
          return (
            <div key={status}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-brand-body/50">
                {COLUMN_TITLES[status]} ({columnPosts.length})
              </h2>
              <div className="space-y-3">
                {columnPosts.length === 0 && (
                  <p className="text-xs text-brand-body/30">Nothing here.</p>
                )}
                {columnPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    listing={post.property_id ? listingById.get(post.property_id) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
