/**
 * Content calendar data access. Draft-and-hold only — see
 * src/types/social.ts's POST_STATUSES comment. No code path in this file
 * (or anywhere in this module) ever marks a post as posted/published,
 * because no live posting integration exists yet.
 *
 * Falls back to an in-memory store (module-level array, reset on server
 * restart) when no Supabase credentials are configured, same rationale as
 * src/lib/data/properties.ts.
 */
import type { CreateSocialPostInput, PostStatus, SocialPost } from '@/types/social';
import { POST_STATUSES } from '@/types/social';
import { hasSupabaseCredentials, createServiceClient } from '@/lib/supabase/service';
import { FIXTURE_POSTS } from '@/lib/data/fixtures';

// In-memory fallback store, seeded from fixtures on first use.
let memoryStore: SocialPost[] | null = null;
function getMemoryStore(): SocialPost[] {
  if (memoryStore === null) {
    memoryStore = FIXTURE_POSTS.map((p) => ({ ...p }));
  }
  return memoryStore;
}

export class InvalidPostStateError extends Error {}

/** Co-branded posts must name a developer; own-branded posts must not. Mirrors the DB CHECK constraint in db/schema.sql. */
function assertBrandModeConsistency(input: Pick<CreateSocialPostInput, 'brand_mode' | 'developer_partner_name'>) {
  if (input.brand_mode === 'co_branded' && !input.developer_partner_name) {
    throw new InvalidPostStateError('co_branded posts require developer_partner_name');
  }
  if (input.brand_mode === 'own' && input.developer_partner_name) {
    throw new InvalidPostStateError('own-branded posts must not set developer_partner_name');
  }
}

export async function listPosts(): Promise<SocialPost[]> {
  if (!hasSupabaseCredentials()) {
    return [...getMemoryStore()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load posts: ${error.message}`);
  return (data ?? []) as SocialPost[];
}

export async function getPost(id: string): Promise<SocialPost | null> {
  if (!hasSupabaseCredentials()) {
    return getMemoryStore().find((p) => p.id === id) ?? null;
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('social_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to load post: ${error.message}`);
  return (data as SocialPost | null) ?? null;
}

export async function createPost(input: CreateSocialPostInput): Promise<SocialPost> {
  assertBrandModeConsistency(input);
  const now = new Date().toISOString();
  const post: SocialPost = {
    id: crypto.randomUUID(),
    kind: input.kind,
    platform: input.platform,
    status: 'draft',
    brand_mode: input.brand_mode,
    developer_partner_name: input.developer_partner_name ?? null,
    property_id: input.property_id ?? null,
    caption: input.caption ?? '',
    caption_source: 'template',
    scheduled_for: input.scheduled_for ?? null,
    created_by_role: input.created_by_role,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  };

  if (!hasSupabaseCredentials()) {
    getMemoryStore().unshift(post);
    return post;
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('social_posts').insert(post).select('*').single();
  if (error) throw new Error(`Failed to create post: ${error.message}`);
  return data as SocialPost;
}

/**
 * Every allowed transition, all within draft-and-hold. There is
 * deliberately no "posted" state to transition into — see module header.
 */
export const ALLOWED_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ['pending_approval', 'held'],
  pending_approval: ['approved', 'held', 'draft'],
  approved: ['held', 'draft'],
  held: ['draft', 'pending_approval'],
};

export async function updatePostStatus(id: string, status: PostStatus): Promise<SocialPost> {
  if (!POST_STATUSES.includes(status)) {
    throw new InvalidPostStateError(`Unknown status: ${status}`);
  }
  const existing = await getPost(id);
  if (!existing) throw new InvalidPostStateError(`Post not found: ${id}`);
  if (status !== existing.status && !ALLOWED_TRANSITIONS[existing.status].includes(status)) {
    throw new InvalidPostStateError(`Cannot transition post from ${existing.status} to ${status}`);
  }

  const updated: SocialPost = { ...existing, status, updated_at: new Date().toISOString() };

  if (!hasSupabaseCredentials()) {
    const store = getMemoryStore();
    const idx = store.findIndex((p) => p.id === id);
    if (idx >= 0) store[idx] = updated;
    return updated;
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('social_posts')
    .update({ status, updated_at: updated.updated_at })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Failed to update post status: ${error.message}`);
  return data as SocialPost;
}
