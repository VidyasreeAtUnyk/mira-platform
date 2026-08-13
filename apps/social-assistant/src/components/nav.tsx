import Link from 'next/link';
import { getViewerRole } from '@/lib/auth/viewer-role';
import { setViewerRole } from '@/app/actions';
import { BRAND_COPY } from '@/lib/brand/tokens';
import { RoleSwitcher } from '@/components/role-switcher';

const LINKS = [
  { href: '/calendar', label: 'Content Calendar' },
  { href: '/posters/new', label: 'New Poster' },
  { href: '/performance', label: 'Performance' },
];

export async function Nav() {
  const role = await getViewerRole();

  return (
    <header className="border-b border-brand-hairline bg-brand-bg-alt">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <Link href="/calendar" className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-[0.2em] text-brand-gold">
              {BRAND_COPY.wordmarkLine1}
            </span>
            <span className="text-[10px] tracking-[0.15em] text-brand-gold-light">
              SOCIAL ASSISTANT
            </span>
          </Link>
          <nav className="flex gap-4 text-sm">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-brand-body/80 transition hover:text-brand-gold"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <RoleSwitcher currentRole={role} action={setViewerRole} />
      </div>
      <p className="mx-auto max-w-5xl px-4 pb-2 text-[11px] text-brand-body/50">
        &quot;Viewing as&quot; is a stand-in for real RBAC/auth (none is wired up yet) -- not a
        security boundary. Poster creation is Owner/COO-only (SPEC.md&apos;s &quot;founder-only-for-now&quot;) per SPEC.md.
      </p>
    </header>
  );
}
