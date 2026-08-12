'use server';

/**
 * App-wide server actions. Currently just the viewer-role switcher -- see
 * src/lib/auth/viewer-role.ts for why this is a stand-in, not real auth.
 */
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { VIEWER_ROLE_COOKIE_NAME } from '@/lib/auth/viewer-role';
import { POSTER_CREATOR_VIEWER_ROLES, type ViewerRole } from '@/types/social';

function isViewerRole(value: string): value is ViewerRole {
  return (POSTER_CREATOR_VIEWER_ROLES as readonly string[]).includes(value);
}

export async function setViewerRole(formData: FormData): Promise<void> {
  const role = formData.get('role');
  if (typeof role !== 'string' || !isViewerRole(role)) {
    return;
  }
  const store = await cookies();
  store.set(VIEWER_ROLE_COOKIE_NAME, role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  revalidatePath('/', 'layout');
}
