'use client';

import { useRef } from 'react';
import { POSTER_CREATOR_VIEWER_ROLES, VIEWER_ROLE_LABELS, type ViewerRole } from '@/types/social';

interface RoleSwitcherProps {
  currentRole: ViewerRole;
  action: (formData: FormData) => void | Promise<void>;
}

/**
 * Client boundary for the nav's viewer-role stand-in (see
 * src/lib/auth/viewer-role.ts) -- Server Components can't attach DOM event
 * handlers, so the auto-submit-on-change behavior lives here while the
 * server action itself stays server-side.
 */
export function RoleSwitcher({ currentRole, action }: RoleSwitcherProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2 text-xs text-brand-body/60">
      <label htmlFor="role" className="whitespace-nowrap">
        Viewing as
      </label>
      <select
        id="role"
        name="role"
        defaultValue={currentRole}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded border border-brand-hairline bg-brand-bg px-2 py-1 text-brand-body"
      >
        {POSTER_CREATOR_VIEWER_ROLES.map((r) => (
          <option key={r} value={r}>
            {VIEWER_ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="rounded border border-brand-hairline px-2 py-1">
          Set
        </button>
      </noscript>
    </form>
  );
}
